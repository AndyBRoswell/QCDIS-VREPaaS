console.log(process.env.NODE_ENV);

module.exports = {
  reactStrictMode: true,
  output: "standalone",
  basePath: process.env.FRONTEND_BASE_PATH,
  publicRuntimeConfig: {
    basePath: process.env.FRONTEND_BASE_PATH,
    staticFolder: process.env.FRONTEND_BASE_PATH,
    apiBasePath: process.env.API_BASE_PATH.replace(/^\/|\/$/g, ''),
  }
}
