{
  description = "eink-server flake with flake-parts";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{
      self,
      nixpkgs,
      flake-parts,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];

      perSystem =
        {
          pkgs,
          lib,
          ...
        }:
        {
          devShells.default = pkgs.mkShell {
            buildInputs = with pkgs; [
              chromium
              nodejs
              pnpm
              esbuild
              esphome
            ];

            shellHook = ''
              export PATH="$PATH:$(git rev-parse --show-toplevel)/node_modules/.bin"
              pnpm install --frozen-lockfile
            '';

            # Lock this to package.json.
            ESBUILD_BINARY_PATH = "${lib.getExe pkgs.esbuild}";
          };
        };
    };
}
