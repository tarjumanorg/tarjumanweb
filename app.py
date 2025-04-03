import os
import msvcrt

# --- (Keep EXCLUDE_FILES, EXCLUDE_DIRS, EXCLUDE_PATHS as they are) ---
# Add project.txt itself to the exclusion list so it doesn't read its own output
EXCLUDE_FILES = {
    ".env",
    ".gitignore",
    "LICENSE",
    "package-lock.json",
    "package.json",
    "project.txt",  # <--- Add this line
    "README.md",
}

EXCLUDE_DIRS = {
    ".astro",
    ".netlify",
    ".vscode",
    "icons",
    "images",
    "styles",
    "node_modules",
    ".git",
    "public",
}

EXCLUDE_PATHS = {
    os.path.normpath("src/pages/404.astro"),
    os.path.normpath("src/pages/privacy.astro"),
    os.path.normpath("src/pages/terms.astro"),
}

# --- (Keep get_file_list, display_file_list, get_content_with_separator as they are) ---

def get_file_list(directory):
    """Gets a list of files, excluding specified files and directories."""
    file_list = []
    script_name = os.path.basename(__file__) # Get the script's own name
    for root, dirs, files in os.walk(directory):

        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for file in files:
            # Construct the full path to check against the script's absolute path
            full_file_path = os.path.join(root, file)
            # Get relative path for display and exclusion checks
            relative_file_path = os.path.relpath(full_file_path, start=directory)
            normalized_relative_path = os.path.normpath(relative_file_path)

            if (
                file in EXCLUDE_FILES
                # Exclude the script file itself more reliably
                or os.path.abspath(full_file_path) == os.path.abspath(__file__)
                or normalized_relative_path in EXCLUDE_PATHS
            ):
                continue

            file_list.append(normalized_relative_path) # Store normalized relative path
    return file_list

def display_file_list(file_list, selected_index, included_files):
    """Displays the file list with interactive selection markers."""
    os.system('cls' if os.name == 'nt' else 'clear') # More cross-platform clear
    print("Use arrow keys (or H/P) to move, spacebar to include/exclude, Enter to finish:")
    # Limit display if list is very long (optional, but good practice)
    max_display = 20
    start_index = max(0, selected_index - max_display // 2)
    end_index = min(len(file_list), start_index + max_display)

    if start_index > 0:
        print("  ...")

    for i in range(start_index, end_index):
        file_path = file_list[i]
        marker = "*" if file_path in included_files else " "
        cursor = ">" if i == selected_index else " "
        print(f"  {cursor} {file_path} {marker}")

    if end_index < len(file_list):
        print("  ...")
    print(f"\nSelected {len(included_files)} files. Press Enter to write to project.txt.")


def get_content_with_separator(file_path, content):
    """Formats the file content with separators for display."""
    separator = "---"
    # Use forward slashes in the output for consistency, even on Windows
    normalized_path_for_output = file_path.replace(os.sep, '/')
    formatted_content = f"{separator}\n\n`{normalized_path_for_output}`:\n```\n{content}\n```\n"
    return formatted_content

def main():
    """Main function: interactive file selection and content writing to file."""
    start_dir = os.path.dirname(os.path.abspath(__file__))
    file_list = get_file_list(start_dir)

    if not file_list:
        print("No files found (after exclusions).")
        return

    selected_index = 0
    # Store included files as a list to maintain order, if desired, or keep as set for efficiency
    # Let's keep it as a list to potentially write in selection order (though current loop doesn't guarantee it)
    # Or better: keep the set for quick checks, but use the original file_list order for writing
    included_files_set = set()


    while True:
        display_file_list(file_list, selected_index, included_files_set)

        # Using msvcrt might still be needed for Windows instant key reads without Enter
        # For cross-platform, libraries like 'readchar' or 'getch' (unix) or 'keyboard' exist
        # but sticking to msvcrt as per the original code for now.
        key = msvcrt.getch()

        # Handle potential prefix byte for arrow keys (0xe0 or 0x00)
        if key in (b'\x00', b'\xe0'):
            key = msvcrt.getch() # Read the actual key code
            if key == b'H' and selected_index > 0:  # Up Arrow
                selected_index -= 1
            elif key == b'P' and selected_index < len(file_list) - 1:  # Down Arrow
                selected_index += 1
            # Add Left/Right if needed (e.g., b'K', b'M')
        elif key == b'\r': # Enter
            break
        elif key == b' ': # Spacebar
            file_path = file_list[selected_index]
            if file_path in included_files_set:
                included_files_set.remove(file_path)
            else:
                included_files_set.add(file_path)
        # Allow using regular H and P too if no prefix was read
        elif key == b'h' or key == b'H':
             if selected_index > 0: selected_index -= 1
        elif key == b'p' or key == b'P':
             if selected_index < len(file_list) - 1: selected_index += 1


    os.system('cls' if os.name == 'nt' else 'clear')

    if not included_files_set:
        print("No files were selected. Exiting.")
        return

    output_filename = "project.txt"
    output_filepath = os.path.join(start_dir, output_filename)

    print(f"Writing {len(included_files_set)} selected files to {output_filepath}...")

    try:
        with open(output_filepath, 'w', encoding='utf-8') as outfile:
            # Iterate through the original file_list to potentially maintain order
            # and check if the file was selected.
            files_written_count = 0
            for file_path in file_list:
                if file_path in included_files_set:
                    full_path = os.path.join(start_dir, file_path)
                    try:
                        with open(full_path, 'r', encoding='utf-8', errors='replace') as infile:
                            content = infile.read()
                        # Write formatted content to the output file
                        outfile.write(get_content_with_separator(file_path, content))
                        files_written_count += 1
                    except Exception as e:
                        # Print errors to console, but continue writing other files
                        print(f"  [!] Error reading {file_path}: {e}")
                        # Optionally write an error marker to the output file too:
                        # outfile.write(f"---\n\nError reading {file_path}: {e}\n\n---\n")

            # Write the final separator after all files
            outfile.write("---\n")

        print(f"Successfully wrote {files_written_count} files to {output_filepath}")

    except IOError as e:
        print(f"\n[!] Error: Could not write to file {output_filepath}.")
        print(f"  Reason: {e}")
    except Exception as e:
        print(f"\n[!] An unexpected error occurred during writing: {e}")


if __name__ == "__main__":
    main()