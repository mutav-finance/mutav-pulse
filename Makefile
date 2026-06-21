default: build

build:
	stellar contract build

test:
	cargo test

fmt:
	cargo fmt --all

clean:
	cargo clean
