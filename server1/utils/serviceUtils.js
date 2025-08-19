const axios = require('axios');

const VOTE_SERVICE_URL = process.env.VOTE_SERVICE_URL || 'http://localhost:3003';

const callService = async (service, endpoint, method = 'GET', data = null, headers = {}) => {
    const baseURL = service === 'vote' ? VOTE_SERVICE_URL : 'http://localhost:3003';
    const url = `${baseURL}${endpoint}`;
    
    console.log(`[CALL SERVICE] ${method} ${url}`);
    
    try {
        const config = {
            method: method.toLowerCase(),
            url,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.data = data;
        }
        
        const response = await axios(config);
        return response.data;
        
    } catch (error) {
        console.error(`[CALL SERVICE]  ${method} ${url} →`, error.message);
        const errorToThrow = new Error(`Vote service error: ${error.message}`);
        errorToThrow.status = error.response?.status || 503;
        errorToThrow.originalError = error.response?.data || error.message;
        throw errorToThrow;
    }
};

module.exports = { callService };