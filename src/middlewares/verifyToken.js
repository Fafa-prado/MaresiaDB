import createError from 'http-errors';
import jwt from 'jsonwebtoken';

const verifyToken = (req, res, next) => {
	let token = req.cookies.token; // Tenta pegar do cookie primeiro

	// Se não houver cookie, tenta pegar do header Authorization
	if (!token && req.headers.authorization) {
		const authHeader = req.headers.authorization;
		if (authHeader.startsWith('Bearer ')) {
			token = authHeader.substring(7);
		}
	}

	if (!token) {
		return next(createError(401, 'Token not provided'));
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded;
		next();
	} catch (error) {
		return next(createError(403, 'Invalid or expired token'));
	}
}

export default verifyToken;