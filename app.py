import os
import msvcrt

EXCLUDE_FILES = {
    ".env",
    ".gitignore",
    "LICENSE",
    "package-lock.json",
    "package.json",
    "project.txt",
    "README.md",
}

EXCLUDE_DIRS = {
    ".astro",
    ".netlify",
    ".vscode",
    "icons",  # Just the directory name
    "images",
    "styles",
    "node_modules",
    ".git",
    "public",
}

EXCLUDE_PATHS = {
    os.path.normpath("src/pages/404.astro"),  # Use os.path.normpath
    os.path.normpath("src/pages/privacy.astro"),
    os.path.normpath("src/pages/terms.astro"),
}

def get_file_list(directory):
    """Gets a list of files, excluding specified files and directories."""
    file_list = []
    for root, dirs, files in os.walk(directory):
        # Efficient directory exclusion
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for file in files:
            file_path = os.path.relpath(os.path.join(root, file), start=directory)

            if (
                file in EXCLUDE_FILES
                or file == os.path.basename(__file__)
                or os.path.normpath(file_path) in EXCLUDE_PATHS  # Normalized path
            ):
                continue

            file_list.append(file_path)
    return file_list

def display_file_list(file_list, selected_index, included_files):
    """Displays the file list with interactive selection markers."""
    os.system('cls')  # Clear the console (Windows specific)
    print("Use arrow keys to move, spacebar to include/exclude, Enter to finish:")
    for i, file_path in enumerate(file_list):
        marker = "*" if file_path in included_files else " "
        cursor = ">" if i == selected_index else " "
        print(f"  {cursor} {file_path} {marker}")

def get_content_with_separator(file_path, content):
    """Formats the file content with separators for display."""
    separator = "---"
    formatted_content = f"{separator}\n\n`{file_path}`:\n```\n{content}\n```\n"
    return formatted_content

def main():
    """Main function: interactive file selection and content display."""
    start_dir = os.path.dirname(os.path.abspath(__file__))
    file_list = get_file_list(start_dir)

    if not file_list:
        print("No files found (after exclusions).")
        return

    selected_index = 0
    included_files = set()

    while True:
        display_file_list(file_list, selected_index, included_files)

        key = msvcrt.getch()
        if key == b'\r':  # Enter key
            break
        elif key == b' ':  # Spacebar
            file_path = file_list[selected_index]
            if file_path in included_files:
                included_files.remove(file_path)
            else:
                included_files.add(file_path)
        elif key == b'H' and selected_index > 0:  # Up arrow
            selected_index -= 1
        elif key == b'P' and selected_index < len(file_list) - 1:  # Down arrow
            selected_index += 1

    os.system('cls') #clear the console before printing the final output.
    print("Selected Files:")
    for file_path in included_files:
        full_path = os.path.join(start_dir, file_path)
        try:
            with open(full_path, 'r', encoding='utf-8', errors='replace') as f: #added error handling
                content = f.read()
            print(get_content_with_separator(file_path, content))
        except Exception as e:
            print(f"Error reading {file_path}: {e}")

    print("---")  # Final separator

if __name__ == "__main__":
    main()