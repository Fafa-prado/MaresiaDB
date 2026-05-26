import fs from 'fs';
import mime from 'mime-types';
import { PrismaClient } from '#generated/prisma/index.js';

import collections from './data/collections.json' with { type: 'json' };
import products from './data/products.json' with { type: 'json' };

const prisma = new PrismaClient();

const imageToBase64 = (imagePath) => {
	const base64 = fs.readFileSync(new URL(imagePath, import.meta.url), 'base64');
	const mimeType = mime.lookup(imagePath);
	return `data:${mimeType};base64,${base64}`;
};

const main = async () => {
	console.log('Starting seed...');

	// Clear existing data
	await prisma.product.deleteMany();
	await prisma.collection.deleteMany();

	// Create collections with explicit IDs
	for (const collection of collections) {
		const imageBase64 = imageToBase64(collection.image);

		await prisma.collection.create({
			data: {
				id: collection.id,
				title: collection.title,
				description: collection.description,
				image: imageBase64,
			},
		});
	}

	// Create products linked to collections by ID
	for (const product of products) {
		await prisma.product.create({
			data: {
				name: product.name,
				description: product.description,
				detailedDescription: product.detailedDescription,
				price: product.price,
				size: product.size,
				color: product.color,
				material: product.material,
				category: product.category,
				available: product.available,
				new: product.new,
				collectionId: product.collectionId,
			},
		});
	}
};

main()
	.then(async () => {
		console.log('🌱');
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
