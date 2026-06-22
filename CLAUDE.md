# Project description

This is the website for the club `Aquis Mana`, a local club in Aachen, Germany. The website should state the clubs purpose, a way to become a paying member (via PDF form) and most importantly show the clubs event calender.

# Aquis Mana e.V.
The clubs purpose is to offer room/space for gaming communities in Aachen. It was founded by a group of Magic, the Gathering players, but every tabletop group is welcome. The club explicitly wants to make the player groups accessible for younger players, since the lack of public gaming spaces means that most groups typically meet in pubs or restaurants and usually in the evening

# Open Tasks

At the start of every session, read `TODO.md` in the project root. It lists outstanding features and improvements. When picking up a task:
1. Work on one task at a time unless instructed otherwise.
2. Mark the item `[x]` in `TODO.md` when the implementation is complete and committed.
3. If a task is partially done, add a brief note below the item describing what remains.

# Architecture

The website will be running in a kubernetes cluster. If a database is required, postgres should be used. However, content needs to be editable by non technical users, so a CMS like wordpress is required. If user management is required, it should be OIDC based, with the OIDC provider running in the same cluster.
