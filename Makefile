.PHONY: default build test fmt clean sync-deploy

default: build

build:
	stellar contract build

test:
	cargo test

fmt:
	cargo fmt --all

clean:
	cargo clean

# Regenerate the committed deploy config (frontend/.env.example, the docs
# deployments table, and the README deploy block) from the deploy record
# (./.env.local) + on-chain validation. Run after a redeploy so the copies
# can't drift.
sync-deploy:
	bash scripts/sync-deploy.sh
