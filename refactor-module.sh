#!/bin/bash

# Check for correct usage
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 old_mod_name new_mod_name"
    exit 1
fi

OLD_MOD_NAME=$1
NEW_MOD_NAME=$2

# Update the module name in go.mod
sed -i "s|^module $OLD_MOD_NAME|module $NEW_MOD_NAME|" go.mod

# Find and replace all occurrences of the old module name in .go files
find . -type f -name "*.go" -exec sed -i "s|$OLD_MOD_NAME|$NEW_MOD_NAME|g" {} +

echo "Module name refactored from '$OLD_MOD_NAME' to '$NEW_MOD_NAME'"
