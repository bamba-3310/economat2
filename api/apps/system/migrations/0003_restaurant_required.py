import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("restaurants", "0002_seed_and_backfill"),
        ("system", "0002_multi_tenant_restaurant"),
    ]

    operations = [
        migrations.AlterField(
            model_name="branding",
            name="restaurant",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="branding",
                to="restaurants.restaurant",
            ),
        ),
    ]
