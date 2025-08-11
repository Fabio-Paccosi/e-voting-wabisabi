const Election = sequelize.define('Election', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    startDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    coinjoinTrigger: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
        comment: 'Numero minimo di voti per triggare il CoinJoin'
    },
    coinjoinEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Se il CoinJoin è abilitato per questa elezione'
    },
    maxVotersAllowed: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Numero massimo di votanti autorizzati'
    },
    votingMethod: {
        type: DataTypes.ENUM('single', 'preferential', 'ranked'),
        defaultValue: 'single'
    },
    status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled'),
        defaultValue: 'draft'
    },
    blockchainNetwork: {
        type: DataTypes.ENUM('mainnet', 'testnet', 'regtest'),
        defaultValue: 'testnet'
    }
});