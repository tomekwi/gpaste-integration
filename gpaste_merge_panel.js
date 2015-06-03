const St = imports.gi.St;
const Lang = imports.lang;

const GPasteMergePanel = new Lang.Class({
    Name: 'GPasteMergePanel',

    _init: function() {
        this.actor = new St.BoxLayout({
            vertical: false,
            visible: false
        });

        this._merge_button = new St.Button({
            label: '  Merge  ',
            style_class: 'gpaste-button'
        });

        let decorator_label = new St.Label({
            text: 'decorator  '
        });
        this._decorator_entry = new St.Entry({
            width: 50,
            style: 'font-size: 12px'
        });
        let separator_label = new St.Label({
            text: '  separator  '
        });
        this._separator_entry = new St.Entry({
            width: 50,
            style: 'font-size: 12px;'
        });
        let merge_box = new St.BoxLayout({
            vertical: false,
            style: 'padding-top: 10px;'
        });
        merge_box.add_child(decorator_label);
        merge_box.add_child(this._decorator_entry);
        merge_box.add_child(separator_label);
        merge_box.add_child(this._separator_entry);
        merge_box.add_child(this._merge_button);

        this._merge_count_label = new St.Label();

        this.actor.add(this._merge_count_label, {
            x_expand: false,
            x_fill: false,
            x_align: St.Align.START,
            y_expand: true,
            y_fill: false,
            y_align: St.Align.MIDDLE
        });
        this.actor.add(merge_box, {
            expand: true,
            x_fill: false,
            x_align: St.Align.END,
            y_fill: false,
            y_align: St.Align.MIDDLE
        });
    },

    set_label: function(text) {
        this._merge_count_label.set_text(text);
    },

    show: function() {
        this.actor.show();
    },

    hide: function() {
        this.actor.hide();
    },

    get decorator_entry() {
        return this._decorator_entry;
    },

    get separator_entry() {
        return this._separator_entry;
    },

    get decorator() {
        return this._decorator_entry.get_text();
    },

    get separator() {
        return this._separator_entry.get_text();
    },

    get button() {
        return this._merge_button;
    }
});