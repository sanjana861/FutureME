/**
 * Validation Service for FutureMe OS onboarding request flow.
 */

/**
 * Validates onboarding input fields.
 * Required fields: full_name, dream_role, dream_company, learning_time.
 * @param {Object} body - Request body
 * @returns {Object} - Object indicating validation status: { isValid: boolean, error?: string }
 */
function validateOnboardingInput(body) {
  const { full_name, dream_role, dream_company, learning_time } = body || {};

  if (
    !full_name || typeof full_name !== 'string' || !full_name.trim() ||
    !dream_role || typeof dream_role !== 'string' || !dream_role.trim() ||
    !dream_company || typeof dream_company !== 'string' || !dream_company.trim() ||
    !learning_time || typeof learning_time !== 'string' || !learning_time.trim()
  ) {
    return {
      isValid: false,
      error: 'Required fields: Full Name, Dream Role, Dream Company, and Learning Time.'
    };
  }

  return { isValid: true };
}

/**
 * Validates if the parent user record exists in the database.
 * @param {Object} db - Database connection instance
 * @param {number|string} userId - User ID to check
 * @returns {Promise<boolean>} - True if user exists, false otherwise
 */
async function validateUserExists(db, userId) {
  if (!userId) return false;
  
  try {
    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    return !!user;
  } catch (error) {
    console.error('[ONBOARDING_LOG] [validationService] Error querying database for user validation:', error);
    return false;
  }
}

module.exports = {
  validateOnboardingInput,
  validateUserExists
};
