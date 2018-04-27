/**
 * Crafted in Erebor by thorin on 2018-04-26
 */
import bcrypt from 'react-native-bcrypt';

// Hash password for added safety
// Password MUST be hashed server-side, with unique salt
const salt = process.env.CLIENT_HASH || '$2a$10$gR5VqKxUstdO.HZeDNb4n.';

const hash = password => bcrypt.hashSync(password, salt);

export default hash;
