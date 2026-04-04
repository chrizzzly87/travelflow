#!/bin/sh
set -eu

repo_root="$(git rev-parse --show-toplevel)"
cd "${repo_root}"

common_dir="$(git rev-parse --git-common-dir)"
case "${common_dir}" in
  /*) common_dir_abs="${common_dir}" ;;
  *) common_dir_abs="$(cd "${repo_root}/${common_dir}" && pwd)" ;;
esac

primary_root="$(cd "${common_dir_abs}/.." && pwd)"
hooks_dir="${primary_root}/.githooks"

mkdir -p "${hooks_dir}"
cp -fp "${repo_root}/.githooks/post-checkout" "${hooks_dir}/post-checkout"
chmod +x "${hooks_dir}/post-checkout"

git config core.hooksPath "${hooks_dir}"

echo "Configured core.hooksPath=${hooks_dir}"
