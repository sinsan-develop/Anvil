"""Base persistence metadata."""
from alembic import op
import sqlalchemy as sa
revision = "0001_base"
down_revision = None
branch_labels = None
depends_on = None
def upgrade():
    op.create_table("anvil_metadata", sa.Column("key", sa.String(128), primary_key=True), sa.Column("value", sa.Text(), nullable=False), sa.Column("version_id", sa.Integer(), nullable=False, server_default="1"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")))
def downgrade():
    op.drop_table("anvil_metadata")
