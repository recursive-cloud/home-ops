#!/bin/bash -e

cat .tool-versions \
| cut -d' ' -f1 | sort | uniq \
| comm -23 - <(asdf plugin list | sort) \
| join -a1 - <(asdf plugin list all) \
| xargs -t -L1 -r asdf plugin add
