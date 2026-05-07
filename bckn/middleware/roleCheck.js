/**
 * Role-based access control middleware
 * @param {...string} allowedRoles - Roles that can access the route
 * @returns {Function} Middleware function
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required' 
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: `Access denied. ${req.user.role} cannot access this resource.`,
                requiredRoles: allowedRoles,
                yourRole: req.user.role
            });
        }

        next();
    };
};

/**
 * Check if user has any of the specified roles
 * Less strict than requireRole (allows if ANY role matches)
 */
const hasAnyRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (roles.includes(req.user.role)) {
            return next();
        }

        return res.status(403).json({ 
            error: `Access denied. Requires one of: ${roles.join(', ')}` 
        });
    };
};

/**
 * Resource ownership check
 * Ensures user can only access their own resources (unless admin)
 */
const requireOwnership = (getResourceUserId) => {
    return async (req, res, next) => {
        try {
            // Admin can access everything
            if (req.user.role === 'admin') {
                return next();
            }

            // Get the user ID associated with the resource
            const resourceUserId = await getResourceUserId(req);
            
            if (req.user._id.toString() !== resourceUserId.toString()) {
                return res.status(403).json({ 
                    error: 'Access denied. You can only access your own resources.' 
                });
            }
            
            next();
        } catch (error) {
            res.status(500).json({ error: 'Ownership check failed.' });
        }
    };
};

module.exports = { requireRole, hasAnyRole, requireOwnership };