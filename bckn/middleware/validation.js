/**
 * Validation middleware using Joi or custom validators
 * For simplicity, we'll use custom validators first
 */

// Helper function to validate email
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Helper function to validate password (min 6 chars)
const isValidPassword = (password) => {
    return password && password.length >= 6;
};

// Validation rules for different routes
const validate = {
    // Login validation
    login: (req, res, next) => {
        const { email, password } = req.body;
        const errors = [];

        if (!email) errors.push('Email is required');
        if (!password) errors.push('Password is required');
        if (email && !isValidEmail(email)) errors.push('Invalid email format');

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }
        next();
    },

    // User registration validation
    register: (req, res, next) => {
        const { name, email, password, role } = req.body;
        const errors = [];

        if (!name) errors.push('Name is required');
        if (!email) errors.push('Email is required');
        if (!password) errors.push('Password is required');
        if (!role) errors.push('Role is required');
        
        if (name && name.length < 2) errors.push('Name must be at least 2 characters');
        if (email && !isValidEmail(email)) errors.push('Invalid email format');
        if (password && !isValidPassword(password)) errors.push('Password must be at least 6 characters');
        
        const validRoles = ['admin', 'client', 'developer'];
        if (role && !validRoles.includes(role)) errors.push('Invalid role');

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }
        next();
    },

    // Task creation validation
    createTask: (req, res, next) => {
        const { title, description, assignedTo, clientId } = req.body;
        const errors = [];

        if (!title) errors.push('Title is required');
        if (!description) errors.push('Description is required');
        if (!assignedTo) errors.push('Assigned developer is required');
        
        if (title && title.length < 3) errors.push('Title must be at least 3 characters');
        if (description && description.length < 10) errors.push('Description must be at least 10 characters');

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }
        next();
    },

    // Task update validation
    updateTask: (req, res, next) => {
        const allowedFields = ['title', 'description', 'status', 'priority'];
        const updates = Object.keys(req.body);
        
        const isValidOperation = updates.every(update => allowedFields.includes(update));
        
        if (!isValidOperation) {
            return res.status(400).json({ 
                error: `Invalid updates! Allowed fields: ${allowedFields.join(', ')}` 
            });
        }
        
        // Validate status if being updated
        if (req.body.status) {
            const validStatuses = ['pending', 'in-progress', 'completed'];
            if (!validStatuses.includes(req.body.status)) {
                return res.status(400).json({ 
                    error: `Invalid status. Allowed: ${validStatuses.join(', ')}` 
                });
            }
        }
        
        // Validate priority if being updated
        if (req.body.priority) {
            const validPriorities = ['low', 'medium', 'high'];
            if (!validPriorities.includes(req.body.priority)) {
                return res.status(400).json({ 
                    error: `Invalid priority. Allowed: ${validPriorities.join(', ')}` 
                });
            }
        }
        
        next();
    },

    // Password reset validation
    resetPassword: (req, res, next) => {
        const { email, token, newPassword } = req.body;
        const errors = [];

        if (!email) errors.push('Email is required');
        if (!token) errors.push('Reset token is required');
        if (!newPassword) errors.push('New password is required');
        
        if (newPassword && !isValidPassword(newPassword)) {
            errors.push('Password must be at least 6 characters');
        }
        
        if (email && !isValidEmail(email)) errors.push('Invalid email format');

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }
        next();
    },

    // User creation by admin
    createUserByAdmin: (req, res, next) => {
        const { name, email, role, company } = req.body;
        const errors = [];

        if (!name) errors.push('Name is required');
        if (!email) errors.push('Email is required');
        if (!role) errors.push('Role is required');
        
        if (name && name.length < 2) errors.push('Name must be at least 2 characters');
        if (email && !isValidEmail(email)) errors.push('Invalid email format');
        
        const validRoles = ['client', 'developer']; // Admin can only create client/developer
        if (role && !validRoles.includes(role)) errors.push('Admin can only create client or developer roles');

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }
        next();
    }
};

module.exports = { validate, isValidEmail, isValidPassword };