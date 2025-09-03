const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    let token;

    // Try to get token from cookies first (httpOnly)
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }
    // Fallback to Authorization header for backwards compatibility
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Not authorized to access this route" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
      if (!req.user) {
        return res.status(401).json({ message: "User not found" });
      }
      next();
    } catch (err) {
      // If access token is expired, try to refresh it automatically
      if (
        err.name === "TokenExpiredError" &&
        req.cookies &&
        req.cookies.refreshToken
      ) {
        try {
          const refreshToken = req.cookies.refreshToken;
          const refreshDecoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET
          );
          const user = await User.findById(refreshDecoded.id);

          if (!user) {
            return res.status(401).json({ message: "Invalid refresh token" });
          }

          // Generate new tokens
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            user.getSignedJwtToken();

          // Set new httpOnly cookies
          res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 60 * 60 * 1000, // 1 hour
          });

          res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });

          // Set user for the request
          req.user = user;
          next();
        } catch (refreshErr) {
          return res.status(401).json({
            message: "Not authorized to access this route",
            expired: true,
            action: "please_login_again",
          });
        }
      } else {
        return res.status(401).json({
          message: "Not authorized to access this route",
          error: err.message,
        });
      }
    }
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { protect };
