#!/bin/bash

echo "🚀 Démarrage du site Astro + Payload CMS"
echo ""
echo "📋 Vérification de MongoDB..."

# Vérifier si MongoDB est en cours d'exécution
if pgrep -x "mongod" > /dev/null
then
    echo "✅ MongoDB est en cours d'exécution"
else
    echo "⚠️  MongoDB n'est pas en cours d'exécution"
    echo "   Démarrage de MongoDB..."

    # Essayer de démarrer MongoDB selon l'OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew services start mongodb-community
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo systemctl start mongodb
    fi

    sleep 2

    if pgrep -x "mongod" > /dev/null
    then
        echo "✅ MongoDB démarré avec succès"
    else
        echo "❌ Impossible de démarrer MongoDB automatiquement"
        echo "   Veuillez démarrer MongoDB manuellement ou utiliser MongoDB Atlas"
        echo "   Consultez le GUIDE_DEMARRAGE.md pour plus d'informations"
        exit 1
    fi
fi

echo ""
echo "🎯 Démarrage du backend (Payload CMS) et du frontend (Astro)..."
echo ""
echo "📍 Backend : http://localhost:3000/admin"
echo "📍 Frontend : http://localhost:4321"
echo ""
echo "⏳ Patientez quelques secondes pour que les serveurs démarrent..."
echo ""

# Démarrer les deux serveurs avec concurrently
npm run dev
