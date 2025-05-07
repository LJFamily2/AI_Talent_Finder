const authRoutes = require("./auth");

const routes = [
  {
    path: "/api/auth",
    route: authRoutes,
  },
];

module.exports = routes;
