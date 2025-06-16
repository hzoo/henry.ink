export function formatCount(count: number) {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}m`;
    }
    
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    
    return count;
}