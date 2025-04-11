import os
import msvcrt
import sys # <-- Import sys for platform check

# --- (Keep EXCLUDE_FILES, EXCLUDE_DIRS, EXCLUDE_PATHS as they are) ---
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

# --- (Keep get_file_list as it is) ---
def get_file_list(directory):
    """Gets a list of files, excluding specified files and directories."""
    file_list = []
    script_name = os.path.basename(__file__) # Get the script's own name
    for root, dirs, files in os.walk(directory):

        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for file in files:
            full_file_path = os.path.join(root, file)
            relative_file_path = os.path.relpath(full_file_path, start=directory)
            normalized_relative_path = os.path.normpath(relative_file_path)

            if (
                file in EXCLUDE_FILES
                or os.path.abspath(full_file_path) == os.path.abspath(__file__)
                or normalized_relative_path in EXCLUDE_PATHS
            ):
                continue

            file_list.append(normalized_relative_path)
    return file_list

# --- Updated display_file_list ---
def display_file_list(file_list, selected_index, included_files):
    """Displays the file list with interactive selection markers."""
    os.system('cls' if os.name == 'nt' else 'clear')
    # --- Updated Instructions ---
    print("Interactive File Selection:")
    print("  Arrows/H/P: Move | Space: Toggle | A: Select All | N: Select None | Enter: Finish")
    print("-" * 60)
    # --- End Updated Instructions ---

    max_display = 20
    start_index = max(0, selected_index - max_display // 2)
    end_index = min(len(file_list), start_index + max_display)

    if start_index > 0:
        print("  ...")

    for i in range(start_index, end_index):
        file_path = file_list[i]
        marker = "*" if file_path in included_files else " "
        cursor = ">" if i == selected_index else " "
        # Ensure consistent display width (optional but nice)
        print(f"  {cursor} {file_path:<50} {marker}") # Left-align path in 50 chars

    if end_index < len(file_list):
        print("  ...")
    print("-" * 60)
    print(f"Selected {len(included_files)} of {len(file_list)} files. Press Enter to write to project.txt.")


# --- (Keep get_content_with_separator as it is) ---
def get_content_with_separator(file_path, content):
    """Formats the file content with separators for display."""
    separator = "---"
    normalized_path_for_output = file_path.replace(os.sep, '/')
    formatted_content = f"{separator}\n\n`{normalized_path_for_output}`:\n```\n{content}\n```\n"
    return formatted_content

# --- Updated main function ---
def main():
    """Main function: interactive file selection and content writing to file."""
    start_dir = os.path.dirname(os.path.abspath(__file__))
    file_list = get_file_list(start_dir)

    if not file_list:
        print("No files found (after exclusions).")
        return

    selected_index = 0
    included_files_set = set() # Start with none selected

    # --- Check for non-Windows OS and suggest alternative ---
    if sys.platform != "win32":
        print("Warning: This script uses 'msvcrt' for key input, which is Windows-specific.")
        print("Interactive selection might not work correctly on this OS.")
        print("Consider using libraries like 'readchar' or 'curses' for cross-platform compatibility.")
        # Optionally, you could fall back to a non-interactive mode here
        # or just let it proceed knowing it might fail on key input.

    while True:
        display_file_list(file_list, selected_index, included_files_set)

        try:
            key = msvcrt.getch()
        except ImportError:
             print("\nError: msvcrt module not found. Interactive selection requires Windows.")
             print("Exiting.")
             return # Exit if msvcrt cannot be used

        # Handle potential prefix byte for arrow keys (0xe0 or 0x00)
        is_special_key = False
        if key in (b'\x00', b'\xe0'):
            is_special_key = True
            key = msvcrt.getch() # Read the actual key code

        if is_special_key:
            if key == b'H' and selected_index > 0:  # Up Arrow
                selected_index -= 1
            elif key == b'P' and selected_index < len(file_list) - 1:  # Down Arrow
                selected_index += 1
            # Add Left/Right if needed (e.g., b'K', b'M')
        elif key == b'\r': # Enter
            break
        elif key == b' ': # Spacebar - Toggle current file
            file_path = file_list[selected_index]
            if file_path in included_files_set:
                included_files_set.remove(file_path)
            else:
                included_files_set.add(file_path)
        # --- New Key Handlers ---
        elif key == b'a' or key == b'A': # Select All
             included_files_set.update(file_list) # Add all items from file_list to the set
        elif key == b'n' or key == b'N': # Select None (Deselect All)
             included_files_set.clear() # Remove all items from the set
        # --- End New Key Handlers ---
        # Allow using regular H and P too if no prefix was read
        elif key == b'h' or key == b'H':
             if selected_index > 0: selected_index -= 1
        elif key == b'p' or key == b'P':
             if selected_index < len(file_list) - 1: selected_index += 1
        # Add a way to quit cleanly if needed, e.g., 'q'
        # elif key == b'q' or key == b'Q':
        #     print("\nQuitting selection.")
        #     included_files_set.clear() # Ensure nothing is written if quitting
        #     break


    os.system('cls' if os.name == 'nt' else 'clear')

    if not included_files_set:
        print("No files were selected. Exiting.")
        return

    output_filename = "project.txt"
    output_filepath = os.path.join(start_dir, output_filename)

    print(f"Writing {len(included_files_set)} selected files to {output_filepath}...")

    # --- (Keep the file writing logic the same) ---
    try:
        with open(output_filepath, 'w', encoding='utf-8') as outfile:
            files_written_count = 0
            # Keep iterating through original list to potentially maintain order
            for file_path in file_list:
                if file_path in included_files_set:
                    full_path = os.path.join(start_dir, file_path)
                    try:
                        with open(full_path, 'r', encoding='utf-8', errors='replace') as infile:
                            content = infile.read()
                        outfile.write(get_content_with_separator(file_path, content))
                        files_written_count += 1
                    except Exception as e:
                        print(f"  [!] Error reading {file_path}: {e}")
                        # outfile.write(f"---\n\nError reading {file_path}: {e}\n\n---\n")

            outfile.write("---\n")

        print(f"Successfully wrote {files_written_count} files to {output_filepath}")

    except IOError as e:
        print(f"\n[!] Error: Could not write to file {output_filepath}.")
        print(f"  Reason: {e}")
    except Exception as e:
        print(f"\n[!] An unexpected error occurred during writing: {e}")


if __name__ == "__main__":
    main()