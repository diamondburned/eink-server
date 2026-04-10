{
  self,
  lib,
  pnpm,
  nodejs,
  stdenvNoCC,
  makeWrapper,
  fetchPnpmDeps,
  pnpmConfigHook,

  extraNpmPackages ? [ ],
}:

let
  srcExcluded = [
    "esphome"
    "nix"
  ];
in

stdenvNoCC.mkDerivation (final: {
  pname = "eink-server";
  version = self.rev or "unknown";

  src = lib.cleanSourceWith {
    src = lib.cleanSource self;
    # Filter out Nix packaging and ESPHome files.
    filter = name: _: !(lib.any (exclude: lib.hasSuffix exclude name) srcExcluded);
  };

  buildInputs = [
    nodejs
  ];

  nativeBuildInputs = [
    pnpm
    pnpmConfigHook
    makeWrapper
  ];

  prePnpmInstall = lib.optionalString (extraNpmPackages != [ ]) ''
    pnpm add ${lib.escapeShellArgs extraNpmPackages}
  '';

  pnpmDeps = fetchPnpmDeps {
    inherit (final) pname version src;
    inherit pnpm;
    hash = lib.fileContents ./pnpmDepsHash;
    fetcherVersion = 3;
  };

  buildPhase = ''
    runHook preBuild

    ls -la .
    pnpm run build

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/share/eink-server
    mv build $out/share/eink-server/
    cp -r package.json node_modules $out/share/eink-server/

    mkdir -p $out/bin
    makeWrapper ${lib.getExe nodejs} $out/bin/eink-server \
      --set NODE_PATH ${placeholder "out"}/share/eink-server/node_modules \
      --add-flags "${placeholder "out"}/share/eink-server/build"

    runHook postInstall
  '';

  meta = {
    mainProgram = "eink-server";
  };
})
