ENV := dev
FE  := STACK=frontend ENV=$(ENV) ./tf
BE  := STACK=backend  ENV=$(ENV) ./tf

.PHONY: fe-init fe-plan fe-apply fe-destroy fe-output fe-validate \
        be-init be-plan be-apply be-destroy be-output be-validate \
        fmt

# ── Frontend stack ────────────────────────────────────────────────────────────
fe-init:
	$(FE) init

fe-plan:
	$(FE) plan

fe-apply:
	$(FE) apply

fe-destroy:
	$(FE) destroy

fe-output:
	$(FE) output

fe-validate:
	$(FE) validate

# ── Backend stack ─────────────────────────────────────────────────────────────
be-init:
	$(BE) init

be-plan:
	$(BE) plan

be-apply:
	$(BE) apply

be-destroy:
	$(BE) destroy

be-output:
	$(BE) output

be-validate:
	$(BE) validate

# ── Shared ────────────────────────────────────────────────────────────────────
fmt:
	terraform fmt -recursive .
