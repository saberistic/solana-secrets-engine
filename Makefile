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
	CGO_ENABLED=0 GOOS=$(OS) GOARCH="$(GOARCH)" go build -o vault/plugins/spiral-safe cmd/spiral-safe/main.go

start:
	vault server -dev -dev-root-token-id=root -dev-plugin-dir=./vault/plugins

enable:
	vault secrets enable -path=spiral-safe spiral-safe

clean:
	rm -rf ./vault

fmt:
	go fmt $$(go list ./...)

tests:
	yarn run ts-mocha -p ./tsconfig.json -t 1000000 scripts/create-transaction.ts

.PHONY: build clean fmt start enable
