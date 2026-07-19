.PHONY: install dev api web typecheck clean

install:
	pnpm install

dev:
	pnpm -r --parallel run dev

api:
	pnpm --filter @dataweb/api dev

web:
	pnpm --filter @dataweb/web dev

typecheck:
	pnpm -r run typecheck

clean:
	rm -rf node_modules apps/*/node_modules apps/*/__pycache__
