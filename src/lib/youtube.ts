/**
 * Backward compatibility re-export surface for YouTube integration
 */

export * from "./youtube/index";

// Alias for backwards compatibility
import { parseYouTubeUrl } from "./youtube/youtube-parser";
export const validateAndExtractYouTube = parseYouTubeUrl;
