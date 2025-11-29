import fs from "fs";
import path from "path";
import mime from "mime-types";
import { PrismaClient } from "#generated/prisma/index.js";

const prisma = new PrismaClient();

// Função auxiliar: converte imagem em base64
async function encodeImageToBase64(imageFile) {
	try {
		// Remove "images/" do início se já estiver no nome do arquivo
		const cleanFile = imageFile.startsWith("images/")
			? imageFile.replace(/^images\//, "")
			: imageFile;

		// Caminho completo correto
		const fullPath = path.resolve("prisma/seed/images", cleanFile);

		// Lê e converte o arquivo
		const buffer = fs.readFileSync(fullPath);
		const mimeType = mime.lookup(fullPath) || "image/jpeg";
		return `data:${mimeType};base64,${buffer.toString("base64")}`;
	} catch (error) {
		console.warn(`⚠️  Erro ao ler imagem: ${imageFile} — ${error.message}`);
		return null;
	}
}

// Inserir coleções
async function seedCollections() {
	const collectionsPath = path.resolve("prisma/seed/data/collections.json");
	const collectionsData = JSON.parse(fs.readFileSync(collectionsPath, "utf-8"));

	console.log("🌸 Inserindo coleções...");

	for (const collection of collectionsData) {
		let imageBase64 = null;

		if (collection.image && collection.image.trim() !== "") {
			imageBase64 = await encodeImageToBase64(collection.image);
		}

		await prisma.collection.create({
			data: {
				title: collection.title,
				description: collection.description,
				image: imageBase64,
			},
		});

		console.log(`✅ Coleção inserida: ${collection.title}`);
	}
}

// Inserir produtos
async function seedProducts() {
	const productsPath = path.resolve("prisma/seed/data/products.json");
	const productsData = JSON.parse(fs.readFileSync(productsPath, "utf-8"));

	console.log("👕 Inserindo produtos...");

	for (const product of productsData) {
		const images = {};

		for (let i = 1; i <= 5; i++) {
			const key = `image${i}`;
			if (product[key] && product[key].trim() !== "") {
				images[key] = await encodeImageToBase64(product[key]);
			}
		}

		await prisma.product.create({
			data: {
				name: product.name,
				description: product.description,
				detailedDescription: product.detailedDescription,
				price: product.price,
				size:
					typeof product.size === "string" && product.size.trim() === ""
						? null
						: product.size,
				color:
					typeof product.color === "string" && product.color.trim() === ""
						? null
						: product.color,
				material: product.material,
				category: product.category,
				available: product.available,
				new: product.new,
				collectionId: product.collectionId || null,
				...images,
			},
		});

		console.log(`🛍️  Produto inserido: ${product.name}`);
	}
}

// Inserir avaliações
async function seedReviews() {
	const reviewsPath = path.resolve("prisma/seed/data/reviews.json");
	const reviewsData = JSON.parse(fs.readFileSync(reviewsPath, "utf-8"));

	console.log("⭐ Inserindo avaliações...");

	for (const review of reviewsData) {
		await prisma.review.create({
			data: {
				productId: review.productId,
				userId: review.userId,
				comentario: review.comentario,
				estrelas: review.estrelas,
			},
		});
	}

	console.log(`✅ ${reviewsData.length} avaliações inseridas com sucesso!`);
}

// Inserir usuários
async function seedUsers() {
	const usersPath = path.resolve("prisma/seed/data/users.json");
	const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));

	console.log("👤 Inserindo usuários...");

	for (const user of usersData) {
		await prisma.user.create({
			data: {
				name: user.name,
				username: user.username,
				password: user.password,
				email: user.email,
				birthdate: user.birthdate ? new Date(user.birthdate) : null,
				cpf: user.cpf,
				gender: user.gender,
				phone: user.phone,
			},
		});

		console.log(`✅ Usuário inserido: ${user.name}`);
	}
}

// Função principal
async function main() {
	console.log("🌱 Iniciando seed...");

	await seedUsers();
	await seedCollections();
	await seedProducts();
	await seedReviews();

	console.log("✅ Seed finalizado com sucesso!");
}

// Execução
main()
	.catch(async (e) => {
		console.error("❌ Erro no seed:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});