const multer = require('multer');
const path = require('path');
const upload = multer({
    dest: 'uploads/',
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/');
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, Date.now() + ext);
        },
    }),
});

const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");

const express = require("express");
const app = express();

app.use(express.json());
app.use(cors());
const uri = "mongodb+srv://tomdesvignes031:wh7Emtt4chDKIaJq@stand-pizza.d2y0rsl.mongodb.net/";

// const uri = "mongodb+srv://tomdesvignes031:W1q5VQtTqcTdJEHK@stand-pizza.d2y0rsl.mongodb.net/";
// const uri = "mongodb+srv://tomdesvignes031:3BAq8uH*nkCx8N#@stand-pizza.d2y0rsl.mongodb.net/";

const client = new MongoClient(uri, {});

let database;
let collection;
let pizzaCollection;

const startServer = async () => {
    await client.connect();
    console.log("Connexion à la base de données établie avec succès");
    database = client.db("Stand-pizza");
    collection = database.collection("commandes-pizza");

    pizzaCollection = database.collection("pizzas");

    const changeStream = collection.watch();

    changeStream.on("change", (change) => {
        io.emit("dataChange", change);
    });
};

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://stand-pizza.online/",
        methods: ["GET", "POST"],
        credentials: true,
        transports: ['websocket', 'polling'],
    },
});

app.use("*", async (req, res, next) => {
    if (database && collection && pizzaCollection) {
        next();
    }
    else {
        await startServer();
        next();
    }
});

app.get("/api/uploads/:filename", async (req, res) => {
    try {
        const filename = req.params.filename;
        res.header["Content-Type"] = "image/png";
        res.sendFile(__dirname + "/uploads/" + filename);
    } catch (error) {
        console.error("Erreur lors de la récupération du fichier :", error);
        res.status(500).json({ error: "Erreur lors de la récupération du fichier" });
    }
});

app.get("/api/data", async (req, res) => {
    try {
        const query = {};
        const result = await collection.find(query).toArray();
        res.json(result);
    } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
        res.status(500).json({ error: "Erreur lors de la récupération des données" });
    }
});

app.post("/api/place-order", async (req, res) => {
    try {
        const { firstName, deliveryTime, orderItems } = req.body;
        console.log("Données de la commande reçues :", req.body);

        const orderDocument = {
            firstName: firstName,
            deliveryTime: deliveryTime,
            orderItems: orderItems,
        };

        await collection.insertOne(orderDocument);

        res.status(200).json({ message: "Commande enregistrée avec succès" });
    } catch (error) {
        console.error("Erreur lors de la commande :", error);
        res.status(500).json({ error: "Erreur lors de la commande" });
    }
});

app.get("/api/pizzas", async (req, res) => {
    try {
        const pizzas = await pizzaCollection.find({}).toArray();
        res.json(pizzas);
    } catch (error) {
        console.error("Erreur lors de la récupération des pizzas :", error);
        res.status(500).json({ error: "Erreur lors de la récupération des pizzas" });
    }
});

app.post('/api/add-pizza', upload.single('logo'), async (req, res) => {
    try {
        const { name } = req.body;

        if (!req.file) {
            throw new Error("Aucun fichier n'a été téléchargé.");
        }

        const logo = req.file.filename;

        const pizzaDocument = {
            name: name,
            logo: logo,
        };

        await pizzaCollection.insertOne(pizzaDocument);

        res.status(200).json({ message: 'Pizza ajoutée avec succès' });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la pizza :", error);
        res.status(500).json({ error: error.message || "Erreur lors de l'ajout de la pizza" });
    }
});

app.get("/api/pizza-logos", async (req, res) => {
    try {
        const logos = await pizzaCollection.find({}).toArray();
        res.json(logos);
    } catch (error) {
        console.error("Erreur lors de la récupération des logos de pizzas :", error);
        res.status(500).json({ error: "Erreur lors de la récupération des logos de pizzas" });
    }
});

app.use('/uploads', express.static('uploads'));

app.delete("/api/pizzas/:id", async (req, res) => {
    try {
        const pizzaId = req.params.id;

        const result = await pizzaCollection.deleteOne({ _id: new ObjectId(pizzaId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Pizza non trouvée" });
        }

        res.status(200).json({ message: "Pizza supprimée avec succès" });
    } catch (error) {
        console.error("Erreur lors de la suppression de la pizza :", error);
        res.status(500).json({ error: "Erreur lors de la suppression de la pizza" });
    }
});

app.delete("/api/delete-all-orders", async (req, res) => {
    try {
        await collection.deleteMany({});

        res.status(200).json({ message: "Toutes les commandes ont été supprimées avec succès" });
    } catch (error) {
        console.error("Erreur lors de la suppression de toutes les commandes :", error);
        res.status(500).json({ error: "Erreur lors de la suppression de toutes les commandes" });
    }
});

app.delete("/api/delete-order/:id", async (req, res) => {
    const orderId = req.params.id;
    console.log("Deleting order with ID:", orderId);

    // Ajouter la logique pour vérifier si la commande existe avant de la supprimer
    const result = await collection.deleteOne({ _id: new ObjectId(orderId) });

    if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Command not found" });
    }

    res.status(200).json({ message: "Order deleted successfully" });
});


app.put("/api/toggle-payment/:id", async (req, res) => {
    try {
        const orderId = req.params.id;
        const { isPaid } = req.body;

        await collection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { isPaid } }
        );

        res.status(200).json({ message: "Statut de paiement mis à jour avec succès" });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du statut de paiement :", error);
        res.status(500).json({ error: "Erreur lors de la mise à jour du statut de paiement" });
    }
});



module.exports = app;