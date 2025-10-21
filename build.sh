npm run build \
&& npm run docs:build \
&& mkdir -p dist/docs \
&& cp -r doc/.vitepress/dist/* dist/docs/;

# move dist to metadent-app
if [ -d metadent-app ]; then
  rm -rf metadent-app
fi
mv dist metadent-app
echo "Build completed. Output is in the 'metadent-app' directory."