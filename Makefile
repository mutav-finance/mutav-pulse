default: build

build:
	stellar contract build

test:
	cargo test

fmt:
	cargo fmt --all

clean:
	cargo clean

# Regenerate the committed deploy config (frontend/.env.example + the docs
# deployments table) from the deploy env (./.env.local) + on-chain asset metadata.
# Run after a redeploy so the four address copies can never drift.
sync-deploy:
	bash scripts/sync-deploy.sh
