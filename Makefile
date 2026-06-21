default: build

build:
	cargo build --target wasm32v1-none --release

test:
	cargo test

fmt:
	cargo fmt --all

clean:
	cargo clean
