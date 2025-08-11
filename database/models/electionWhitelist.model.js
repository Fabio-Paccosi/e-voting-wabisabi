// database/models/electionWhitelist.model.js
const ElectionWhitelist = sequelize.define('ElectionWhitelist', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Election,
            key: 'id'
        }
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    authorizedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    authorizedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Admin che ha autorizzato'
    },
    hasVoted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    votedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['electionId', 'userId']
        }
    ]
});