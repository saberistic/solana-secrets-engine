package solana_se

import (
	"github.com/go-webauthn/webauthn/webauthn"
)

type User struct {
	Email       string                `json:"email"`
	PubKey      string                `json:"pubKey"`
	Credentials []webauthn.Credential `json:"credentials"`
}

func (u User) WebAuthnID() []byte {
	return []byte(u.Email)
}

// WebAuthnName returns the user's username
func (u User) WebAuthnName() string {
	return u.Email
}

// WebAuthnDisplayName returns the user's display name
func (u User) WebAuthnDisplayName() string {
	return u.Email
}

// WebAuthnIcon is not (yet) implemented
func (u User) WebAuthnIcon() string {
	return ""
}

// AddCredential associates the credential to the user
func (u *User) AddCredential(cred webauthn.Credential) {
	u.Credentials = append(u.Credentials, cred)
}

// WebAuthnCredentials returns credentials owned by the user
func (u User) WebAuthnCredentials() []webauthn.Credential {
	return u.Credentials
}
