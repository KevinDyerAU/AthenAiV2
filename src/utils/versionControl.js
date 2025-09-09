// Version Control Utilities - Git Integration Tools
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

class VersionControlManager {
  constructor(workingDirectory = process.cwd()) {
    this.workingDir = workingDirectory;
  }

  // Git Repository Operations
  async initRepository(repositoryPath = this.workingDir) {
    try {
      const { stdout, stderr } = await execAsync('git init', { cwd: repositoryPath });
      
      // Create initial .gitignore
      const gitignoreContent = `
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Build outputs
dist/
build/
*.tgz

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Temporary files
tmp/
temp/
*.tmp
*.temp

# AthenAI specific
workspace/
generated/
*.cache
`;

      await fs.writeFile(path.join(repositoryPath, '.gitignore'), gitignoreContent.trim(), 'utf8');

      return {
        success: true,
        message: 'Git repository initialized successfully',
        stdout,
        stderr,
        path: repositoryPath
      };
    } catch (error) {
      logger.error('Git init failed', { error: error.message, path: repositoryPath });
      return {
        success: false,
        error: error.message,
        path: repositoryPath
      };
    }
  }

  async cloneRepository(repoUrl, targetPath, options = {}) {
    try {
      const cloneCommand = `git clone ${repoUrl} ${targetPath}`;
      const { stdout, stderr } = await execAsync(cloneCommand, { 
        cwd: path.dirname(targetPath),
        timeout: options.timeout || 300000 // 5 minutes
      });

      return {
        success: true,
        message: 'Repository cloned successfully',
        stdout,
        stderr,
        repoUrl,
        targetPath
      };
    } catch (error) {
      logger.error('Git clone failed', { error: error.message, repoUrl, targetPath });
      return {
        success: false,
        error: error.message,
        repoUrl,
        targetPath
      };
    }
  }

  // File Operations
  async addFiles(files = ['.'], repositoryPath = this.workingDir) {
    try {
      const fileList = Array.isArray(files) ? files.join(' ') : files;
      const { stdout, stderr } = await execAsync(`git add ${fileList}`, { cwd: repositoryPath });

      return {
        success: true,
        message: 'Files added to staging area',
        files: files,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Git add failed', { error: error.message, files });
      return {
        success: false,
        error: error.message,
        files
      };
    }
  }

  async commitChanges(message, repositoryPath = this.workingDir, options = {}) {
    try {
      const author = options.author ? `--author="${options.author}"` : '';
      const commitCommand = `git commit -m "${message}" ${author}`;
      
      const { stdout, stderr } = await execAsync(commitCommand, { cwd: repositoryPath });

      return {
        success: true,
        message: 'Changes committed successfully',
        commitMessage: message,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Git commit failed', { error: error.message, message });
      return {
        success: false,
        error: error.message,
        commitMessage: message
      };
    }
  }

  async pushChanges(remote = 'origin', branch = 'main', repositoryPath = this.workingDir) {
    try {
      const { stdout, stderr } = await execAsync(`git push ${remote} ${branch}`, { cwd: repositoryPath });

      return {
        success: true,
        message: 'Changes pushed successfully',
        remote,
        branch,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Git push failed', { error: error.message, remote, branch });
      return {
        success: false,
        error: error.message,
        remote,
        branch
      };
    }
  }

  async pullChanges(remote = 'origin', branch = 'main', repositoryPath = this.workingDir) {
    try {
      const { stdout, stderr } = await execAsync(`git pull ${remote} ${branch}`, { cwd: repositoryPath });

      return {
        success: true,
        message: 'Changes pulled successfully',
        remote,
        branch,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Git pull failed', { error: error.message, remote, branch });
      return {
        success: false,
        error: error.message,
        remote,
        branch
      };
    }
  }

  // Branch Operations
  async createBranch(branchName, repositoryPath = this.workingDir, checkout = true) {
    try {
      const createCommand = checkout ? `git checkout -b ${branchName}` : `git branch ${branchName}`;
      const { stdout, stderr } = await execAsync(createCommand, { cwd: repositoryPath });

      return {
        success: true,
        message: `Branch ${branchName} created successfully`,
        branchName,
        checkedOut: checkout,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Git branch creation failed', { error: error.message, branchName });
      return {
        success: false,
        error: error.message,
        branchName
      };
    }
  }

  async switchBranch(branchName, repositoryPath = this.workingDir) {
    try {
      const { stdout, stderr } = await execAsync(`git checkout ${branchName}`, { cwd: repositoryPath });

      return {
        success: true,
        message: `Switched to branch ${branchName}`,
        branchName,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Git branch switch failed', { error: error.message, branchName });
      return {
        success: false,
        error: error.message,
        branchName
      };
    }
  }

  async mergeBranch(branchName, repositoryPath = this.workingDir) {
    try {
      const { stdout, stderr } = await execAsync(`git merge ${branchName}`, { cwd: repositoryPath });

      return {
        success: true,
        message: `Branch ${branchName} merged successfully`,
        branchName,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Git merge failed', { error: error.message, branchName });
      return {
        success: false,
        error: error.message,
        branchName
      };
    }
  }

  async deleteBranch(branchName, repositoryPath = this.workingDir, force = false) {
    try {
      const deleteFlag = force ? '-D' : '-d';
      const { stdout, stderr } = await execAsync(`git branch ${deleteFlag} ${branchName}`, { cwd: repositoryPath });

      return {
        success: true,
        message: `Branch ${branchName} deleted successfully`,
        branchName,
        forced: force,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Git branch deletion failed', { error: error.message, branchName });
      return {
        success: false,
        error: error.message,
        branchName
      };
    }
  }

  // Status and Information
  async getStatus(repositoryPath = this.workingDir) {
    try {
      const { stdout, stderr } = await execAsync('git status --porcelain', { cwd: repositoryPath });

      const files = stdout.split('\n').filter(line => line.trim()).map(line => {
        const status = line.substring(0, 2);
        const filename = line.substring(3);
        return { status, filename };
      });

      return {
        success: true,
        files,
        hasChanges: files.length > 0,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Git status failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCurrentBranch(repositoryPath = this.workingDir) {
    try {
      const { stdout, stderr } = await execAsync('git branch --show-current', { cwd: repositoryPath });

      return {
        success: true,
        currentBranch: stdout.trim(),
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Get current branch failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listBranches(repositoryPath = this.workingDir, includeRemote = false) {
    try {
      const command = includeRemote ? 'git branch -a' : 'git branch';
      const { stdout, stderr } = await execAsync(command, { cwd: repositoryPath });

      const branches = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const isCurrent = line.startsWith('*');
          const branchName = line.replace(/^\*?\s+/, '').trim();
          return { name: branchName, current: isCurrent };
        });

      return {
        success: true,
        branches,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('List branches failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCommitHistory(repositoryPath = this.workingDir, limit = 10) {
    try {
      const { stdout, stderr } = await execAsync(
        `git log --oneline -${limit} --pretty=format:"%h|%an|%ad|%s" --date=short`,
        { cwd: repositoryPath }
      );

      const commits = stdout.split('\n').filter(line => line.trim()).map(line => {
        const [hash, author, date, message] = line.split('|');
        return { hash, author, date, message };
      });

      return {
        success: true,
        commits,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Get commit history failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getDiff(repositoryPath = this.workingDir, staged = false) {
    try {
      const command = staged ? 'git diff --cached' : 'git diff';
      const { stdout, stderr } = await execAsync(command, { cwd: repositoryPath });

      return {
        success: true,
        diff: stdout,
        staged,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Get diff failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Remote Operations
  async addRemote(name, url, repositoryPath = this.workingDir) {
    try {
      const { stdout, stderr } = await execAsync(`git remote add ${name} ${url}`, { cwd: repositoryPath });

      return {
        success: true,
        message: `Remote ${name} added successfully`,
        remoteName: name,
        remoteUrl: url,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Add remote failed', { error: error.message, name, url });
      return {
        success: false,
        error: error.message,
        remoteName: name,
        remoteUrl: url
      };
    }
  }

  async listRemotes(repositoryPath = this.workingDir) {
    try {
      const { stdout, stderr } = await execAsync('git remote -v', { cwd: repositoryPath });

      const remotes = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, url, type] = line.split(/\s+/);
          return { name, url, type: type?.replace(/[()]/g, '') };
        });

      return {
        success: true,
        remotes,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('List remotes failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility Methods
  async isGitRepository(repositoryPath = this.workingDir) {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: repositoryPath });
      return true;
    } catch (error) {
      return false;
    }
  }

  async configureUser(name, email, repositoryPath = this.workingDir, global = false) {
    try {
      const scope = global ? '--global' : '--local';
      
      await execAsync(`git config ${scope} user.name "${name}"`, { cwd: repositoryPath });
      await execAsync(`git config ${scope} user.email "${email}"`, { cwd: repositoryPath });

      return {
        success: true,
        message: 'Git user configured successfully',
        name,
        email,
        scope: global ? 'global' : 'local'
      };
    } catch (error) {
      logger.error('Git user configuration failed', { error: error.message, name, email });
      return {
        success: false,
        error: error.message,
        name,
        email
      };
    }
  }

  // Workflow Helpers
  async quickCommit(message, files = ['.'], repositoryPath = this.workingDir) {
    try {
      // Add files
      const addResult = await this.addFiles(files, repositoryPath);
      if (!addResult.success) {
        return addResult;
      }

      // Commit changes
      const commitResult = await this.commitChanges(message, repositoryPath);
      return commitResult;
    } catch (error) {
      logger.error('Quick commit failed', { error: error.message, message, files });
      return {
        success: false,
        error: error.message,
        message,
        files
      };
    }
  }

  async createFeatureBranch(featureName, repositoryPath = this.workingDir) {
    try {
      const branchName = `feature/${featureName}`;
      return await this.createBranch(branchName, repositoryPath, true);
    } catch (error) {
      logger.error('Create feature branch failed', { error: error.message, featureName });
      return {
        success: false,
        error: error.message,
        featureName
      };
    }
  }

  async createReleaseBranch(version, repositoryPath = this.workingDir) {
    try {
      const branchName = `release/${version}`;
      return await this.createBranch(branchName, repositoryPath, true);
    } catch (error) {
      logger.error('Create release branch failed', { error: error.message, version });
      return {
        success: false,
        error: error.message,
        version
      };
    }
  }
}

module.exports = { VersionControlManager };
