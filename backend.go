package solana_se

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/gob"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/hashicorp/errwrap"
	"github.com/hashicorp/vault/sdk/framework"
	"github.com/hashicorp/vault/sdk/logical"
	"github.com/portto/solana-go-sdk/types"
)

type backend struct {
	*framework.Backend
	webauthn *webauthn.WebAuthn
}

type Payload struct {
	PrivateKey     []byte                `json:"privateKey"`
	WebAuthSession *webauthn.SessionData `json:"webAuth"`
	User           User
	Transaction    []byte
}

var _ logical.Factory = Factory

func Factory(ctx context.Context, conf *logical.BackendConfig) (logical.Backend, error) {
	b, err := newBackend()
	if err != nil {
		return nil, err
	}

	if conf == nil {
		return nil, fmt.Errorf("configuration passed into backend is nil")
	}

	wconfig := &webauthn.Config{
		RPDisplayName: "Solana Secrets Engine Webauthn",  // Display Name for your site
		RPID:          "localhost",                       // Generally the FQDN for your site
		RPOrigins:     []string{"http://localhost:9080"}, // The origin URLs allowed for WebAuthn requests
	}

	w, err := webauthn.New(wconfig)
	if err != nil {
		return nil, err
	}
	b.webauthn = w

	if err := b.Setup(ctx, conf); err != nil {
		return nil, err
	}

	return b, nil
}

func newBackend() (*backend, error) {
	b := &backend{}

	b.Backend = &framework.Backend{
		Help:        strings.TrimSpace(solanaSecretEngineHelp),
		BackendType: logical.TypeLogical,
		Paths: framework.PathAppend(
			b.paths(),
		),
	}

	return b, nil
}

func (b *backend) paths() []*framework.Path {
	return []*framework.Path{
		{
			// Pattern: framework.MatchAllRegex("email"),
			// Pattern: fmt.Sprintf("(?P<%s>.+)/(?P<%s>.+)", "email", "action"),
			Pattern: "users",
			Fields: map[string]*framework.FieldSchema{
				"email": {
					Type:        framework.TypeString,
					Description: "Specifies the email of the secret.",
				},
				"credential": {
					Type:        framework.TypeMap,
					Description: "Specifies the email of the secret.",
				},
			},
			Operations: map[logical.Operation]framework.OperationHandler{
				logical.CreateOperation: &framework.PathOperation{
					Callback: b.handleWriteUser,
				},
			},

			ExistenceCheck: b.handleExistenceCheck,
		},
		{
			Pattern: "auth",
			Fields: map[string]*framework.FieldSchema{
				"email": {
					Type:        framework.TypeString,
					Description: "Specifies the email of the secret.",
				},
				"credential": {
					Type:        framework.TypeMap,
					Description: "Specifies the email of the secret.",
				},
				"tx": {
					Type:        framework.TypeString,
					Description: "Specifies the email of the secret.",
				},
			},
			Operations: map[logical.Operation]framework.OperationHandler{
				logical.CreateOperation: &framework.PathOperation{
					Callback: b.handleWriteAuth,
				},
			},
			ExistenceCheck: b.handleExistenceCheck,
		},
	}
}

func (b *backend) handleExistenceCheck(ctx context.Context, req *logical.Request, data *framework.FieldData) (bool, error) {
	out, err := req.Storage.Get(ctx, req.Path)
	if err != nil {
		return false, errwrap.Wrapf("existence check failed: {{err}}", err)
	}

	return out != nil, nil
}

func (b *backend) handleWriteUser(ctx context.Context, req *logical.Request, data *framework.FieldData) (*logical.Response, error) {
	resp := &logical.Response{
		Data: nil,
	}
	if req.ClientToken == "" {
		return nil, fmt.Errorf("client token empty")
	}

	if len(req.Data) == 0 {
		return nil, fmt.Errorf("data must be provided to initialize")
	}
	var email string
	for k, v := range req.Data {
		if k == "email" {
			email = v.(string)
		}
	}
	if email == "" {
		return nil, fmt.Errorf("email field is missing")
	}
	u := User{
		Email: email,
	}
	b.Backend.Logger().Info("Write on user " + u.Email)

	var credential map[string]interface{}
	for k, v := range req.Data {
		if k == "credential" {
			credential = v.(map[string]interface{})
		}
	}

	var v Payload
	entry, err := req.Storage.Get(ctx, req.ClientToken+"/"+u.Email)
	if err != nil {
		return nil, err
	}
	if entry != nil {
		dec := gob.NewDecoder(bytes.NewReader(entry.Value))
		err = dec.Decode(&v)
		if err != nil {
			return nil, fmt.Errorf("can't decode value %v", err)
		}
		if len(v.User.Credentials) > 0 {
			return nil, fmt.Errorf("already registed")
		}
	}
	b.Backend.Logger().Info(fmt.Sprintf("User %v", v.User))

	if len(credential) > 0 {
		b.Backend.Logger().Info("Completing registration on " + u.Email)
		// b.Backend.Logger().Info(fmt.Sprintf("Credential %v", credential))
		var ccr protocol.CredentialCreationResponse
		data, err := json.Marshal(credential)
		if err != nil {
			return nil, fmt.Errorf("can't marshal credential %v", err)
		}
		err = json.Unmarshal(data, &ccr)
		if err != nil {
			return nil, fmt.Errorf("can't unmarshal credential %v", err)
		}

		b.Backend.Logger().Info(fmt.Sprintf("Attestation Response %v", ccr))

		parsedResponse, err := ccr.Parse()
		if err != nil {
			return nil, fmt.Errorf("failed to parse, %s", err.Error())
		}
		credential, err := b.webauthn.CreateCredential(v.User, *v.WebAuthSession, parsedResponse)
		if err != nil {
			return nil, fmt.Errorf("failed to create creds, %s", err)
		}
		v.User.AddCredential(*credential)

		resp.Data = map[string]interface{}{
			"pubKey":      v.User.PubKey,
			"credentials": v.User.Credentials,
		}

	} else {
		b.Backend.Logger().Info("Registering " + u.Email)
		if v.PrivateKey == nil {
			acct := types.NewAccount()
			v.PrivateKey = acct.PrivateKey
			v.User.PubKey = acct.PublicKey.ToBase58()
			v.User.Email = u.Email
			b.Backend.Logger().Info("Creating key " + v.User.PubKey)
		}

		options, session, err := b.webauthn.BeginRegistration(v.User)
		if err != nil {
			return nil, err
		}
		resp.Data = map[string]interface{}{
			"pubKey":  v.User.PubKey,
			"options": options,
		}

		v.WebAuthSession = session
	}

	if v.User.PubKey != "" {
		var buf bytes.Buffer
		enc := gob.NewEncoder(&buf)
		err = enc.Encode(v)
		if err != nil {
			log.Fatalf("Error encoding struct: %v", err)
		}

		entry = &logical.StorageEntry{
			Key:      req.ClientToken + "/" + email,
			Value:    buf.Bytes(),
			SealWrap: false,
		}
		if err := req.Storage.Put(ctx, entry); err != nil {
			return nil, err
		}
	}

	b.Backend.Logger().Info("succeeded!!!")

	return resp, nil

}

func (b *backend) handleWriteAuth(ctx context.Context, req *logical.Request, data *framework.FieldData) (*logical.Response, error) {
	b.Backend.Logger().Info("Write on auth ")
	resp := &logical.Response{
		Data: nil,
	}
	if req.ClientToken == "" {
		return nil, fmt.Errorf("client token empty")
	}

	if len(req.Data) == 0 {
		return nil, fmt.Errorf("data must be provided to initialize")
	}
	var email string
	for k, v := range req.Data {
		if k == "email" {
			email = v.(string)
		}
	}
	if email == "" {
		return nil, fmt.Errorf("email field is missing")
	}
	u := User{
		Email: email,
	}
	b.Backend.Logger().Info("Write on auth " + u.Email)

	var credential map[string]interface{}
	for k, v := range req.Data {
		if k == "credential" {
			credential = v.(map[string]interface{})
		}
	}

	var v Payload
	entry, err := req.Storage.Get(ctx, req.ClientToken+"/"+u.Email)
	if err != nil {
		return nil, err
	}
	if entry != nil {
		dec := gob.NewDecoder(bytes.NewReader(entry.Value))
		err = dec.Decode(&v)
		if err != nil {
			return nil, fmt.Errorf("can't decode value %v", err)
		}
	}
	b.Backend.Logger().Info(fmt.Sprintf("User %v", v.User))

	if len(credential) > 0 {
		b.Backend.Logger().Info("Completing signin on " + u.Email)
		// b.Backend.Logger().Info(fmt.Sprintf("Credential %v", credential))
		var car protocol.CredentialAssertionResponse
		data, err := json.Marshal(credential)
		if err != nil {
			return nil, fmt.Errorf("can't marshal credential %v", err)
		}
		err = json.Unmarshal(data, &car)
		if err != nil {
			return nil, fmt.Errorf("can't unmarshal credential %v", err)
		}

		b.Backend.Logger().Info(fmt.Sprintf("Attestation Response %v", car))

		parsedResponse, err := car.Parse()
		if err != nil {
			return nil, fmt.Errorf("failed to parse, %s", err.Error())
		}
		credential, err := b.webauthn.ValidateLogin(v.User, *v.WebAuthSession, parsedResponse)
		if err != nil {
			return nil, fmt.Errorf("failed to create creds, %s", err)
		}

		tx, err := types.TransactionDeserialize(v.Transaction)
		if err != nil {
			return nil, fmt.Errorf("failed deserializing transaction")
		}
		acct, err := types.AccountFromBytes(v.PrivateKey)
		if err != nil {
			return nil, err
		}
		msg, err := tx.Message.Serialize()
		if err != nil {
			return nil, fmt.Errorf("failed serializing message")
		}
		signature := acct.Sign(msg)
		err = tx.AddSignature(signature)
		if err != nil {
			return nil, fmt.Errorf("failed adding signature")
		}
		serializedTX, err := tx.Serialize()
		if err != nil {
			return nil, fmt.Errorf("failed serializing transaction")
		}
		encodedTX := base64.StdEncoding.EncodeToString(serializedTX)

		resp.Data = map[string]interface{}{
			"pubKey":     v.User.PubKey,
			"credential": credential,
			"encodedTX":  encodedTX,
		}

	} else {
		b.Backend.Logger().Info("Signing in " + u.Email)
		if v.PrivateKey == nil {
			return nil, fmt.Errorf("haven't registered before")
		}

		var base64TX string
		for k, v := range req.Data {
			if k == "tx" {
				base64TX = v.(string)
			}
		}
		if len(base64TX) == 0 {
			return nil, fmt.Errorf("tx must be provided to sign")
		}
		rawDecoded, err := base64.StdEncoding.DecodeString(base64TX)
		if err != nil {
			return nil, fmt.Errorf("tx is not base64 encoded")
		}
		v.Transaction = rawDecoded

		options, session, err := b.webauthn.BeginLogin(v.User)
		if err != nil {
			return nil, err
		}
		resp.Data = map[string]interface{}{
			"pubKey":  v.User.PubKey,
			"options": options,
		}

		v.WebAuthSession = session
	}

	if v.User.PubKey != "" {
		var buf bytes.Buffer
		enc := gob.NewEncoder(&buf)
		err = enc.Encode(v)
		if err != nil {
			log.Fatalf("Error encoding struct: %v", err)
		}

		entry = &logical.StorageEntry{
			Key:      req.ClientToken + "/" + email,
			Value:    buf.Bytes(),
			SealWrap: false,
		}
		if err := req.Storage.Put(ctx, entry); err != nil {
			return nil, err
		}
	}

	b.Backend.Logger().Info("succeeded!!!")

	return resp, nil

}

const solanaSecretEngineHelp = `
The Solana Secrent Engine backend is a secrets backend that creates accounts and signs transactions.
`
