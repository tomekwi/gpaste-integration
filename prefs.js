const Lang = imports.lang;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Params = imports.misc.params;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const PrefsKeys = Me.imports.prefs_keys;
const Utils = Me.imports.utils;
const TweenerTransitionTypes = Me.imports.tweener_transition_types;

const KeybindingsWidget = new GObject.Class({
    Name: 'Keybindings.Widget',
    GTypeName: 'KeybindingsWidget',
    Extends: Gtk.Box,

    _init: function(keybindings) {
        this.parent();
        this.set_orientation(Gtk.Orientation.VERTICAL);

        this._keybindings = keybindings;

        let scrolled_window = new Gtk.ScrolledWindow();
        scrolled_window.set_policy(
            Gtk.PolicyType.AUTOMATIC,
            Gtk.PolicyType.AUTOMATIC
        );

        this._columns = {
            NAME: 0,
            ACCEL_NAME: 1,
            MODS: 2,
            KEY: 3
        };

        this._store = new Gtk.ListStore();
        this._store.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_INT,
            GObject.TYPE_INT
        ]);

        this._tree_view = new Gtk.TreeView({
            model: this._store,
            hexpand: true,
            vexpand: true
        });
        this._tree_view.get_selection().set_mode(Gtk.SelectionMode.SINGLE);

        let action_renderer = new Gtk.CellRendererText();
        let action_column = new Gtk.TreeViewColumn({
            'title': 'Action',
            'expand': true
        });
        action_column.pack_start(action_renderer, true);
        action_column.add_attribute(action_renderer, 'text', 1);
        this._tree_view.append_column(action_column);

        let keybinding_renderer = new Gtk.CellRendererAccel({
            'editable': true,
            'accel-mode': Gtk.CellRendererAccelMode.GTK
        });
        keybinding_renderer.connect('accel-edited',
            Lang.bind(this, function(renderer, iter, key, mods) {
                let value = Gtk.accelerator_name(key, mods);
                let [success, iterator ] =
                    this._store.get_iter_from_string(iter);

                if(!success) {
                    printerr("Can't change keybinding");
                }

                let name = this._store.get_value(iterator, 0);

                this._store.set(
                    iterator,
                    [this._columns.MODS, this._columns.KEY],
                    [mods, key]
                );
                Utils.SETTINGS.set_strv(name, [value]);
            })
        );

        let keybinding_column = new Gtk.TreeViewColumn({
            'title': 'Modify'
        });
        keybinding_column.pack_end(keybinding_renderer, false);
        keybinding_column.add_attribute(
            keybinding_renderer,
            'accel-mods',
            this._columns.MODS
        );
        keybinding_column.add_attribute(
            keybinding_renderer,
            'accel-key',
            this._columns.KEY
        );
        this._tree_view.append_column(keybinding_column);

        scrolled_window.add(this._tree_view);
        this.add(scrolled_window);

        this._refresh();
    },

    _refresh: function() {
        this._store.clear();

        for(let settings_key in this._keybindings) {
            let [key, mods] = Gtk.accelerator_parse(
                Utils.SETTINGS.get_strv(settings_key)[0]
            );

            let iter = this._store.append();
            this._store.set(iter,
                [
                    this._columns.NAME,
                    this._columns.ACCEL_NAME,
                    this._columns.MODS,
                    this._columns.KEY
                ],
                [
                    settings_key,
                    this._keybindings[settings_key],
                    mods,
                    key
                ]
            );
        }
    }
});

const PrefsGrid = new GObject.Class({
    Name: 'Prefs.Grid',
    GTypeName: 'PrefsGrid',
    Extends: Gtk.Grid,

    _init: function(settings, params) {
        this.parent(params);
        this._settings = settings;
        this.margin = this.row_spacing = this.column_spacing = 10;
        this._rownum = 0;
    },

    add_entry: function(text, key) {
        let item = new Gtk.Entry({
            hexpand: false
        });
        item.text = this._settings.get_string(key);
        this._settings.bind(key, item, 'text', Gio.SettingsBindFlags.DEFAULT);

        return this.add_row(text, item);
    },

    add_shortcut: function(text, settings_key) {
        let item = new Gtk.Entry({
            hexpand: false
        });
        item.set_text(this._settings.get_strv(settings_key)[0]);
        item.connect('changed', Lang.bind(this, function(entry) {
            let [key, mods] = Gtk.accelerator_parse(entry.get_text());

            if(Gtk.accelerator_valid(key, mods)) {
                let shortcut = Gtk.accelerator_name(key, mods);
                this._settings.set_strv(settings_key, [shortcut]);
            }
        }));

        return this.add_row(text, item);
    },

    add_boolean: function(text, key) {
        let item = new Gtk.Switch({
            active: this._settings.get_boolean(key)
        });
        this._settings.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);

        return this.add_row(text, item);
    },

    add_combo: function(text, key, list, type) {
        let item = new Gtk.ComboBoxText();

        for(let i = 0; i < list.length; i++) {
            let title = list[i].title.trim();
            let id = list[i].value.toString();
            item.insert(-1, id, title);
        }

        if(type === 'string') {
            item.set_active_id(this._settings.get_string(key));
        }
        else {
            item.set_active_id(this._settings.get_int(key).toString());
        }

        item.connect('changed', Lang.bind(this, function(combo) {
            let value = combo.get_active_id();

            if(type === 'string') {
                if(this._settings.get_string(key) !== value) {
                    this._settings.set_string(key, value);
                }
            }
            else {
                value = parseInt(value, 10);

                if(this._settings.get_int(key) !== value) {
                    this._settings.set_int(key, value);
                }
            }
        }));

        return this.add_row(text, item);
    },

    add_spin: function(label, key, adjustment_properties, type, spin_properties) {
        adjustment_properties = Params.parse(adjustment_properties, {
            lower: 0,
            upper: 100,
            step_increment: 100
        });
        let adjustment = new Gtk.Adjustment(adjustment_properties);

        spin_properties = Params.parse(spin_properties, {
            adjustment: adjustment,
            numeric: true,
            snap_to_ticks: true
        }, true);
        let spin_button = new Gtk.SpinButton(spin_properties);

        if(type !== 'int') spin_button.set_digits(2);

        let get_method = type === 'int' ? 'get_int' : 'get_double';
        let set_method = type === 'int' ? 'set_int' : 'set_double';

        spin_button.set_value(this._settings[get_method](key));
        spin_button.connect('value-changed', Lang.bind(this, function(spin) {
            let value

            if(type === 'int') value = spin.get_value_as_int();
            else value = spin.get_value();

            if(this._settings[get_method](key) !== value) {
                this._settings[set_method](key, value);
            }
        }));

        return this.add_row(label, spin_button, true);
    },

    add_row: function(text, widget, wrap) {
        let label = new Gtk.Label({
            label: text,
            hexpand: true,
            halign: Gtk.Align.START
        });
        label.set_line_wrap(wrap || false);

        this.attach(label, 0, this._rownum, 1, 1); // col, row, colspan, rowspan
        this.attach(widget, 1, this._rownum, 1, 1);
        this._rownum++;

        return widget;
    },

    add_item: function(widget, col, colspan, rowspan) {
        this.attach(
            widget,
            col || 0,
            this._rownum,
            colspan || 2,
            rowspan || 1
        );
        this._rownum++;

        return widget;
    },

    add_range: function(label, key, range_properties) {
        range_properties = Params.parse(range_properties, {
            min: 0,
            max: 100,
            step: 10,
            mark_position: 0,
            add_mark: false,
            size: 200,
            draw_value: true
        });

        let range = Gtk.Scale.new_with_range(
            Gtk.Orientation.HORIZONTAL,
            range_properties.min,
            range_properties.max,
            range_properties.step
        );
        range.set_value(this._settings.get_int(key));
        range.set_draw_value(range_properties.draw_value);

        if(range_properties.add_mark) {
            range.add_mark(
                range_properties.mark_position,
                Gtk.PositionType.BOTTOM,
                null
            );
        }

        range.set_size_request(range_properties.size, -1);

        range.connect('value-changed', Lang.bind(this, function(slider) {
            this._settings.set_int(key, slider.get_value());
        }));

        return this.add_row(label, range, true);
    }
});

const GpasteIntegrationPrefsWidget = new GObject.Class({
    Name: 'GpasteIntegration.Prefs.Widget',
    GTypeName: 'GpasteIntegrationPrefsWidget',
    Extends: Gtk.Box,

    _init: function(params) {
        this.parent(params);
        this.set_orientation(Gtk.Orientation.VERTICAL);

        this._settings = Utils.getSettings();

        let main = this._get_main_page();
        let size = this._get_size_page();
        let animations = this._get_animations_page();
        let keybindings = this._get_keybindings_page();

        let stack = new Gtk.Stack({
            transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
            transition_duration: 500
        });
        let stack_switcher = new Gtk.StackSwitcher({
            margin_left: 5,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 5,
            stack: stack
        });

        stack.add_titled(main.page, main.name, main.name);
        stack.add_titled(size.page, size.name, size.name);
        stack.add_titled(animations.page, animations.name, animations.name);
        stack.add_titled(keybindings.page, keybindings.name, keybindings.name);

        this.add(stack_switcher);
        this.add(stack);
    },

    _get_main_page: function() {
        let name = 'Main';
        let page = new PrefsGrid(this._settings);

        let spin_properties = {
            lower: 100,
            upper: 2000,
            step_increment: 50
        };
        page.add_spin(
            'Preview max width(px):',
            PrefsKeys.PREVIEW_MAX_WIDTH_PX_KEY,
            spin_properties,
            'int'
        );
        page.add_spin(
            'Preview max height(px):',
            PrefsKeys.PREVIEW_MAX_HEIGHT_PX_KEY,
            spin_properties,
            'int'
        );

        page.add_boolean(
            'Item details:',
            PrefsKeys.ENABLE_ITEM_INFO_KEY
        );
        spin_properties = {
            lower: 100,
            upper: 2000,
            step_increment: 100
        };
        page.add_spin(
            'Item info timeout(ms):',
            PrefsKeys.ITEM_INFO_TIMEOUT_KEY,
            spin_properties,
            'int'
        );
        page.add_boolean(
            'Image preview:',
            PrefsKeys.ENABLE_IMAGE_PREVIEW_KEY
        );

        return {
            page: page,
            name: name
        };
    },

    _get_size_page: function() {
        let name = 'Size';
        let page = new PrefsGrid(this._settings);

        let range_properties = {
            min: 10,
            max: 100,
            step: 10,
            size: 300
        };
        page.add_range(
            'Width (% of screen):',
            PrefsKeys.WIDTH_PERCENTS_KEY,
            range_properties
        )
        page.add_range(
            'Height (% of screen):',
            PrefsKeys.HEIGHT_PERCENTS_KEY,
            range_properties
        )
        return {
            page: page,
            name: name
        };
    },

    _get_keybindings_page: function() {
        let name = 'Keybindings';
        let page = new PrefsGrid(this._settings);

        let enable_shortcuts = page.add_boolean(
            'Shortcuts:',
            PrefsKeys.ENABLE_SHORTCUTS_KEY
        );
        enable_shortcuts.connect('notify::active',
            Lang.bind(this, function(s) {
                let active = s.get_active();
                keybindings_widget.set_sensitive(active);
            })
        );

        let shortcuts_enabled = this._settings.get_boolean(
            PrefsKeys.ENABLE_SHORTCUTS_KEY
        );

        let keybindings = {};
        keybindings[PrefsKeys.SHOW_CLIPBOARD_CONTENTS_KEY] =
            'Show clipboard contents(only <Super> modifier)';

        let keybindings_widget = new KeybindingsWidget(keybindings);
        keybindings_widget.set_sensitive(shortcuts_enabled);
        page.add_item(keybindings_widget)

        return {
            page: page,
            name: name
        };
    },

    _get_animations_page: function() {
        let name = 'Animations';
        let page = new PrefsGrid(this._settings);
        let adjustment_properties = {
            lower: 0.1,
            upper: 5.0,
            step_increment: 0.1
        };
        let renderers = [];

        for each(let transition in TweenerTransitionTypes.TWEENER_TRANSITION_TYPES) {
            renderers.push({
                title: transition,
                value: transition
            });
        }

        page.add_boolean(
            'Animations:',
            PrefsKeys.ENABLE_ANIMATIONS_KEY
        );

        page.add_combo(
            'Open transition:',
            PrefsKeys.OPEN_TRANSITION_TYPE_KEY,
            renderers,
            'string'
        );
        page.add_spin(
            'Open animation time:',
            PrefsKeys.OPEN_ANIMATION_TIME_KEY,
            adjustment_properties,
            'double'
        );

        page.add_combo(
            'Close transition:',
            PrefsKeys.CLOSE_TRANSITION_TYPE_KEY,
            renderers,
            'string'
        );
        page.add_spin(
            'Close animation time:',
            PrefsKeys.CLOSE_ANIMATION_TIME_KEY,
            adjustment_properties,
            'double'
        );

        return {
            page: page,
            name: name
        };
    }
});

function init(){
    // nothing
}

function buildPrefsWidget() {
    let widget = new GpasteIntegrationPrefsWidget();
    widget.show_all();

    return widget;
}
