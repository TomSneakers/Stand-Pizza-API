const express = require("express");
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
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

app.use(express.json());
app.use(cors());

const uri = "mongodb+srv://tomdesvignes031:wh7Emtt4chDKIaJq@stand-pizza.d2y0rsl.mongodb.net/";

const client = new MongoClient(uri, {});

let database;
let ordersCollection;
let pizzasCollection;

const connectToDatabase = async () => {
    await client.connect();
    console.log("Connected to the database successfully");
    database = client.db("Stand-pizza");
    ordersCollection = database.collection("commandes-pizza");
    pizzasCollection = database.collection("pizzas");
};

connectToDatabase().catch(console.error);

// Middleware pour vérifier si la base de données est connectée
const checkDatabaseConnection = (req, res, next) => {
    if (database && ordersCollection && pizzasCollection) {
        next();
    } else {
        res.status(500).json({ error: "Database connection error" });
    }
};

// Middleware pour gérer les erreurs
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
};

app.use(checkDatabaseConnection);

// Routes

app.get("/api/uploads/:filename", async (req, res) => {
    try {
        const filename = req.params.filename;
        res.header["Content-Type"] = "image/png";
        res.sendFile(path.join(__dirname, "/uploads/", filename));
    } catch (error) {
        console.error("Erreur lors de la récupération du fichier :", error);
        res.status(500).json({ error: "Erreur lors de la récupération du fichier" });
    }
});

app.get("/api/data", async (req, res) => {
    try {
        const query = {};
        const result = await ordersCollection.find(query).toArray();
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

        await ordersCollection.insertOne(orderDocument);

        res.status(200).json({ message: "Commande enregistrée avec succès" });
    } catch (error) {
        console.error("Erreur lors de la commande :", error);
        res.status(500).json({ error: "Erreur lors de la commande" });
    }
});

app.get("/api/pizzas", async (req, res) => {
    try {
        const pizzas = await pizzasCollection.find({}).toArray();
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

        await pizzasCollection.insertOne(pizzaDocument);

        res.status(200).json({ message: 'Pizza ajoutée avec succès' });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la pizza :", error);
        res.status(500).json({ error: error.message || "Erreur lors de l'ajout de la pizza" });
    }
});

app.get("/api/pizza-logos", async (req, res) => {
    try {
        const logos = await pizzasCollection.find({}).toArray();
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

        const result = await pizzasCollection.deleteOne({ _id: new ObjectId(pizzaId) });

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
        await ordersCollection.deleteMany({});

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
    const result = await ordersCollection.deleteOne({ _id: new ObjectId(orderId) });

    if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Command not found" });
    }

    res.status(200).json({ message: "Order deleted successfully" });
});

app.put("/api/toggle-payment/:id", async (req, res) => {
    try {
        const orderId = req.params.id;
        const { isPaid } = req.body;

        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { isPaid } }
        );

        res.status(200).json({ message: "Statut de paiement mis à jour avecs uccès" });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du statut de paiement :", error);
        res.status(500).json({ error: "Erreur lors de la mise à jour du statut de paiement" });
    }
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
