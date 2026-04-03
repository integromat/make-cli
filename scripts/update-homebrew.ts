import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

function calculateSha256FromFile(path: string): string {
    const buffer = readFileSync(path);
    const hash = createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
}

function generateFormula(version: string, binaries: Record<string, string>): string {
    // Note: #{version} and #{bin} are Ruby string interpolation, not JS template literals
    return `# typed: false
# frozen_string_literal: true

class MakeCLI < Formula
  desc "A command-line tool for Make automation platform"
  homepage "https://www.make.com"
  version "${version}"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/integromat/make-cli/releases/download/v#{version}/make-cli-darwin-arm64.tar.gz"
      sha256 "${binaries['darwin-arm64']}"

      def install
        bin.install "make-cli-darwin-arm64" => "make-cli"
      end
    end

    on_intel do
      url "https://github.com/integromat/make-cli/releases/download/v#{version}/make-cli-darwin-amd64.tar.gz"
      sha256 "${binaries['darwin-amd64']}"

      def install
        bin.install "make-cli-darwin-amd64" => "make-cli"
      end
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/integromat/make-cli/releases/download/v#{version}/make-cli-linux-arm64.tar.gz"
      sha256 "${binaries['linux-arm64']}"

      def install
        bin.install "make-cli-linux-arm64" => "make-cli"
      end
    end

    on_intel do
      url "https://github.com/integromat/make-cli/releases/download/v#{version}/make-cli-linux-amd64.tar.gz"
      sha256 "${binaries['linux-amd64']}"

      def install
        bin.install "make-cli-linux-amd64" => "make-cli"
      end
    end
  end

  test do
    assert_match "make-cli", shell_output("#{bin}/make-cli --help")
  end
end
`;
}

function main() {
    const version = process.env.VERSION;
    const artifactsDir = process.env.ARTIFACTS_DIR || 'artifacts';

    if (!version) {
        console.error('VERSION environment variable is required');
        process.exit(1);
    }

    console.log(`Updating Homebrew formula for version ${version}`);

    const targets = ['darwin-arm64', 'darwin-amd64', 'linux-arm64', 'linux-amd64'];
    const binaries: Record<string, string> = {};

    for (const target of targets) {
        const artifactName = `make-cli-${target}.tar.gz`;
        const filePath = `${artifactsDir}/${artifactName}/${artifactName}`;

        console.log(`Calculating SHA256 for ${artifactName}...`);
        binaries[target] = calculateSha256FromFile(filePath);
        console.log(`  ${target}: ${binaries[target]}`);
    }

    const formula = generateFormula(version, binaries);
    writeFileSync('make-cli.rb', formula);

    console.log('Formula written to make-cli.rb');
}

main();
