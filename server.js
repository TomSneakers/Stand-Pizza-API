// server.js

const multer = require('multer');
const path = require('path'); // Ajoutez cette ligne pour utiliser le module path
const upload = multer({
    dest: 'uploads/',
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/'); // Indiquez le dossier de destination des fichiers
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, Date.now() + ext); // Utilisez la date pour rendre le nom du fichier unique
        },
    }),
});


const express = require("express");
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const corsOptions = {
    origin: "https://stand-pizza.online/", // Remplacez-le par l'URL de votre application front-end
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const uri = "mongodb+srv://tomdesvignes031:W1q5VQtTqcTdJEHK@stand-pizza.d2y0rsl.mongodb.net/";

const client = new MongoClient(uri, {});

// Utilisez l'analyseur de corps natif d'Express pour analyser le corps de la requête au format JSON
app.use(express.json());

// Configurer CORS pour Socket.IO et Express
app.use(
    cors({
        origin: "https://stand-pizza.online/", // Remplacez-le par l'URL de votre application front-end
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        credentials: true,
    })
);

let database;
let collection;
let pizzaCollection; // Définissez la variable de collection ici

const startServer = async () => {
    await client.connect();
    console.log("Connexion à la base de données établie avec succès");
    database = client.db("Stand-pizza");
    collection = database.collection("commandes-pizza");

    // Créer une collection pour les pizzas
    pizzaCollection = database.collection("pizzas");

    // Configurer le change stream pour la collection
    const changeStream = collection.watch();

    // Écouter les modifications et les émettre à tous les clients connectés via WebSocket
    changeStream.on("change", (change) => {
        io.emit("dataChange", change);
    });
};

const io = new Server(server, {
    cors: {
        origin: "https://stand-pizza.online/",
        methods: ["GET", "POST"],
        credentials: true,
        transports: ['websocket', 'polling'],
    },
});

startServer();

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

        // Créez un document à insérer dans la base de données
        const orderDocument = {
            firstName: firstName,
            deliveryTime: deliveryTime,
            orderItems: orderItems,
        };

        // Insérez le document dans la collection
        await collection.insertOne(orderDocument);

        res.status(200).json({ message: "Commande enregistrée avec succès" });
    } catch (error) {
        console.error("Erreur lors de la commande :", error);
        res.status(500).json({ error: "Erreur lors de la commande" });
    }
});

app.get("/api/pizzas", async (req, res) => {
    try {
        // Récupérer toutes les pizzas depuis la collection
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

        // Vérifiez si un fichier a été téléchargé
        if (!req.file) {
            throw new Error("Aucun fichier n'a été téléchargé.");
        }

        const logo = req.file.filename; // Enregistrez le nom du fichier du logo dans la base de données

        // Créez un document à insérer dans la collection de pizzas
        const pizzaDocument = {
            name: name,
            logo: logo, // Stockez le nom du fichier du logo dans la base de données
        };

        // Insérez le document dans la collection
        await pizzaCollection.insertOne(pizzaDocument);

        res.status(200).json({ message: 'Pizza ajoutée avec succès' });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la pizza :", error);
        res.status(500).json({ error: error.message || "Erreur lors de l'ajout de la pizza" });
    }
});
app.get("/api/pizza-logos", async (req, res) => {
    try {
        // Récupérer les logos des pizzas depuis la collection
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

        // Suppression de la pizza
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
        // Supprimez toutes les commandes
        await collection.deleteMany({});

        res.status(200).json({ message: "Toutes les commandes ont été supprimées avec succès" });
    } catch (error) {
        console.error("Erreur lors de la suppression de toutes les commandes :", error);
        res.status(500).json({ error: "Erreur lors de la suppression de toutes les commandes" });
    }
});

app.put("/api/toggle-payment/:id", async (req, res) => {
    try {
        const orderId = req.params.id;
        const { isPaid } = req.body;

        // Update the payment status of the order
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

// Utilisez le même serveur HTTP pour Express et Socket.IO
server.listen(80, () => {
    console.log("Serveur API en cours d'exécution sur le port 80");
});
