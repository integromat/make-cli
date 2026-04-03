#!/bin/bash
set -e

VERSION="${1:-1.0.0}"
ARCH="${2:-amd64}"
PACKAGE_NAME="make-cli"

# Map architecture names
case "$ARCH" in
  x64|amd64)
    DEB_ARCH="amd64"
    ;;
  arm64|aarch64)
    DEB_ARCH="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

WORKDIR="$(mktemp -d)"
PKGDIR="$WORKDIR/${PACKAGE_NAME}_${VERSION}_${DEB_ARCH}"

echo "Building Debian package for $DEB_ARCH..."

# Create directory structure
mkdir -p "$PKGDIR/DEBIAN"
mkdir -p "$PKGDIR/usr/bin"

# Copy binary (uses naming: make-cli-linux-ARCH)
cp "bin/${PACKAGE_NAME}-linux-${DEB_ARCH}" "$PKGDIR/usr/bin/make-cli"
chmod 755 "$PKGDIR/usr/bin/make-cli"

# Create control file
cat > "$PKGDIR/DEBIAN/control" << EOF
Package: $PACKAGE_NAME
Version: $VERSION
Section: utils
Priority: optional
Architecture: $DEB_ARCH
Maintainer: Make <support@make.com>
Description: A command-line tool for Make automation platform
EOF

# Build the package
dpkg-deb --build "$PKGDIR"

# Move to output directory
mkdir -p deb
mv "$WORKDIR/${PACKAGE_NAME}_${VERSION}_${DEB_ARCH}.deb" "deb/${PACKAGE_NAME}-linux-${DEB_ARCH}.deb"

# Cleanup
rm -rf "$WORKDIR"

echo "Created: deb/${PACKAGE_NAME}-linux-${DEB_ARCH}.deb"
