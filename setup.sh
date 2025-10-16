#!/usr/bin/env bash

set -euo pipefail

# check if asdf is installed
if ! command -v asdf &> /dev/null
then
    echo "asdf could not be found, please install asdf first"
    exit 1
fi

echo "Installing task via asdf..."
asdf plugin add task

echo "Getting task version from .tool-versions and installing..."
# get current version of task from .tool-versions
TASK_VERSION=$(grep task .tool-versions | awk '{print $2}')

echo "Installing task version $TASK_VERSION"
asdf install task "$TASK_VERSION"

echo "Setup complete! Run 'task --list' to see available commands."
