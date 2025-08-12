// database/models/user.model.js
const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    taxCode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        unique: true,
        comment: 'Codice fiscale italiano',
        validate: {
            is: /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i
        }
    },
    dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    address: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON con via, città, CAP, provincia'
    },
    documentType: {
        type: DataTypes.ENUM('carta_identita', 'passaporto', 'patente'),
        allowNull: true
    },
    documentNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'suspended', 'inactive'),
        defaultValue: 'active'
    }
});