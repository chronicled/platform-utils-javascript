.PHONY: release


release:
ifeq ($(TAG),)
  $(error "TAG is undefined, aborting")
endif
	npm version "${TAG}" -s -m "chore: %s version"
