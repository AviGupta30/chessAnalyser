export async function fetchUserGames(username) {
    try {
        const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
        if (!archivesRes.ok) throw new Error("User not found or API error");

        const archivesData = await archivesRes.json();
        if (!archivesData.archives || archivesData.archives.length === 0) return [];

        // Fetch the most recent month of games
        const lastArchiveUrl = archivesData.archives[archivesData.archives.length - 1];
        const gamesRes = await fetch(lastArchiveUrl);
        const gamesData = await gamesRes.json();

        // Return the latest 20 games
        return gamesData.games.reverse().slice(0, 20);
    } catch (error) {
        throw new Error("Failed to fetch games for this user.");
    }
}