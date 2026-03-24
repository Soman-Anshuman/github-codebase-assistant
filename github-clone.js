import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Convert the callback-based exec function into a Promise-based one
const execAsync = promisify(exec);

/**
 * Clones a GitHub repository into the system's temporary directory.
 * @param {string} repoUrl - The HTTPS URL of the GitHub repository.
 * @returns {Promise<string>} - The local path to the cloned repository.
 */
async function cloneRepository(repoUrl) {
    const repoName = repoUrl.split('/').pop().replace('.git', '');
    
    // path in system's temporary directory
    const targetPath = path.join(os.tmpdir(), `codebase-assistant-${repoName}-${Date.now()}`);

    console.log(`\nPreparing to clone into: ${targetPath}`);

    try {
        // --depth 1
        // We only want the latest files. We DO NOT want the entire 10-year git commit history.
        // This makes the clone take seconds instead of minutes.
        const cloneCommand = `git clone --depth 1 ${repoUrl} ${targetPath}`;
        
        console.log(`Executing: ${cloneCommand}`);
        await execAsync(cloneCommand);
        
        console.log(`Clone successful!`);
        return targetPath;

    } catch (error) {
        console.error("Failed to clone repository:", error.message);
        throw error;
    }
}

/**
 * Deletes the cloned repository to free up disk space.
 * @param {string} directoryPath - The path to delete.
 */
async function cleanupRepository(directoryPath) {
    console.log(`\nCleaning up: Deleting ${directoryPath}`);
    try {
        fs.rmSync(directoryPath, { recursive: true, force: true });
        console.log(`Cleanup complete. Disk space freed.`);
    } catch (error) {
        console.error("Failed to cleanup directory:", error.message);
    }
}

async function run() {
    // test repo
    const repoUrl = "https://github.com/Soman-Anshuman/STL"; 
    let localRepoPath = "";

    try {
        localRepoPath = await cloneRepository(repoUrl);
        
        // testing by listing the files in the root directory
        console.log("\nFiles in the repository root:");
        const files = fs.readdirSync(localRepoPath);
        console.log(files.join(', '));

        // --- In the future, (Chunking) and (Embedding) will happen here ---

    } catch (error) {
        console.error("Process failed.", error.message);
    } finally {
        if (localRepoPath) {
            await cleanupRepository(localRepoPath);
        }
    }
}

await run();