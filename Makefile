GOARCH = amd64

UNAME = $(shell uname -s)

ifndef OS
	ifeq ($(UNAME), Linux)
		OS = linux
	else ifeq ($(UNAME), Darwin)
		OS = darwin
	endif
endif

.DEFAULT_GOAL := all

all: fmt build start

build:
	CGO_ENABLED=0 GOOS=$(OS) GOARCH="$(GOARCH)" go build -o vault/plugins/solana-secrets-engine cmd/solana-secrets-engine/main.go

start:
	vault server -dev -dev-root-token-id=root -dev-plugin-dir=./vault/plugins

enable:
	vault secrets enable -path=solana-secrets-engine solana-secrets-engine

clean:
	rm -f ./vault/plugins/solana-secret-engine

fmt:
	go fmt $$(go list ./...)

.PHONY: build clean fmt start enable
