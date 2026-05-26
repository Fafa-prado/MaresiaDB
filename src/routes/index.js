import express from 'express';

const router = express.Router();

router.get('/hello-world', async (req, res) => {
	res.json({ message: 'Hello, World!' });
});

export default router;
