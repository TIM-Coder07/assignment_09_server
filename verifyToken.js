export const verifyToken = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).send({ message: "No token provided" });
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "Invalid token format" });
  }

  req.token = token;

  next();
};
