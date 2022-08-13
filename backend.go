package solana_se

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/hashicorp/errwrap"
	"github.com/hashicorp/vault/sdk/framework"
	"github.com/hashicorp/vault/sdk/logical"
	"github.com/portto/solana-go-sdk/types"
)

type backend struct {
	*framework.Backend
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
			Pattern: framework.MatchAllRegex("path"),

			Fields: map[string]*framework.FieldSchema{
				"path": {
					Type:        framework.TypeString,
					Description: "Specifies the path of the secret.",
				},
			},

			Operations: map[logical.Operation]framework.OperationHandler{
				logical.ReadOperation: &framework.PathOperation{
					Callback: b.handleRead,
					Summary:  "Retrieve the secret from the map.",
				},
				logical.UpdateOperation: &framework.PathOperation{
					Callback: b.handleWrite,
					Summary:  "Store a secret at the specified location.",
				},
				logical.CreateOperation: &framework.PathOperation{
					Callback: b.handleWrite,
				},
				logical.DeleteOperation: &framework.PathOperation{
					Callback: b.handleDelete,
					Summary:  "Deletes the secret at the specified location.",
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

func (b *backend) handleRead(ctx context.Context, req *logical.Request, data *framework.FieldData) (*logical.Response, error) {
	b.Backend.Logger().Info("REEEEAAAAD")
	if req.ClientToken == "" {
		return nil, fmt.Errorf("client token empty")
	}

	if len(req.Data) == 0 {
		return nil, fmt.Errorf("data must be provided to sign")
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

	path := data.Get("path").(string)

	entry, err := req.Storage.Get(ctx, req.ClientToken+"/"+path)
	if err != nil {
		return nil, err
	}

	if entry == nil {
		return nil, fmt.Errorf("account doesn't exists")
	}

	tx, err := types.TransactionDeserialize(rawDecoded)
	if err != nil {
		return nil, fmt.Errorf("failed deserializing transaction")
	}

	acct, err := types.AccountFromBytes(entry.Value)
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

	rawData := map[string]interface{}{
		"pubKey":    acct.PublicKey.ToBase58(),
		"encodedTX": encodedTX,
	}

	resp := &logical.Response{
		Data: rawData,
	}

	return resp, nil
}

func (b *backend) handleWrite(ctx context.Context, req *logical.Request, data *framework.FieldData) (*logical.Response, error) {
	if req.ClientToken == "" {
		return nil, fmt.Errorf("client token empty")
	}

	path := data.Get("path").(string)

	acct := types.NewAccount()
	pubKey := acct.PublicKey.ToBase58()

	entry := &logical.StorageEntry{
		Key:      req.ClientToken + "/" + path,
		Value:    acct.PrivateKey,
		SealWrap: false,
	}
	if err := req.Storage.Put(ctx, entry); err != nil {
		return nil, err
	}
	rawData := map[string]interface{}{
		"pubKey": pubKey,
	}

	resp := &logical.Response{
		Data: rawData,
	}

	b.Backend.Logger().Info("succeeded!!!")

	return resp, nil
}

func (b *backend) handleDelete(ctx context.Context, req *logical.Request, data *framework.FieldData) (*logical.Response, error) {
	if req.ClientToken == "" {
		return nil, fmt.Errorf("client token empty")
	}

	path := data.Get("path").(string)

	if err := req.Storage.Delete(ctx, req.ClientToken+"/"+path); err != nil {
		return nil, err
	}

	return nil, nil
}

const solanaSecretEngineHelp = `
The Solana Secrent Engine backend is a secrets backend that creates accounts and signs transactions.
`
